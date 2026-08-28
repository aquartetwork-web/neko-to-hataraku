begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) values (
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'nfc-timer@example.com',
  '',
  now(),
  now(),
  now()
);

insert into app_private.nfc_devices (
  user_id,
  label,
  tag_id_hash,
  device_token_hash
) values (
  '33333333-3333-3333-3333-333333333333',
  'test reader',
  encode(sha256(convert_to('5A95A319014189', 'UTF8')), 'hex'),
  encode(sha256(convert_to('test-device-token-with-at-least-32-bytes', 'UTF8')), 'hex')
);

select ok(
  has_function_privilege('anon', 'public.toggle_work_via_nfc(text,text,uuid)', 'EXECUTE'),
  'anon may execute only the credential-gated NFC RPC'
);
select ok(
  not has_function_privilege('anon', 'app_private.start_or_switch_work_for_user(uuid,uuid,uuid)', 'EXECUTE'),
  'anon cannot execute the shared start implementation'
);
select ok(
  not has_function_privilege('anon', 'app_private.stop_work_for_user(uuid)', 'EXECUTE'),
  'anon cannot execute the shared stop implementation'
);
select ok(
  not has_schema_privilege('anon', 'app_private', 'USAGE'),
  'anon cannot use the private schema'
);

set local role anon;

select throws_ok(
  $$
    select public.toggle_work_via_nfc(
      '00000000000000',
      'test-device-token-with-at-least-32-bytes',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    )
  $$,
  '42501',
  'NFC credential rejected',
  'an unknown tag is rejected'
);

select throws_ok(
  $$
    select public.toggle_work_via_nfc(
      '5A95A319014189',
      'wrong-device-token-with-at-least-32-bytes',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    )
  $$,
  '42501',
  'NFC credential rejected',
  'an incorrect device token is rejected'
);

create temporary table nfc_test_results (
  key text primary key,
  result jsonb not null
);

insert into nfc_test_results values (
  'start',
  public.toggle_work_via_nfc(
    '5a:95:a3:19:01:41:89',
    'test-device-token-with-at-least-32-bytes',
    'cccccccc-cccc-cccc-cccc-cccccccccccc'
  )
);

select is(
  (select result ->> 'action' from nfc_test_results where key = 'start'),
  'start',
  'NFC starts work when no session is open'
);
select is(
  (select (result ->> 'duplicate')::boolean from nfc_test_results where key = 'start'),
  false,
  'the first event is not marked duplicate'
);
select is(
  (select count(*)::integer from public.work_sessions where ended_at is null),
  1,
  'NFC start creates one open session'
);
select is(
  (select count(*)::integer from public.work_segments where ended_at is null),
  1,
  'NFC start creates one open work segment'
);

insert into nfc_test_results values (
  'duplicate',
  public.toggle_work_via_nfc(
    '5A95A319014189',
    'test-device-token-with-at-least-32-bytes',
    'cccccccc-cccc-cccc-cccc-cccccccccccc'
  )
);

select is(
  (select (result ->> 'duplicate')::boolean from nfc_test_results where key = 'duplicate'),
  true,
  'replaying the same event id is marked duplicate'
);
select is(
  (select count(*)::integer from public.work_sessions where ended_at is null),
  1,
  'replaying the same event does not stop work'
);

insert into nfc_test_results values (
  'stop',
  public.toggle_work_via_nfc(
    '5A95A319014189',
    'test-device-token-with-at-least-32-bytes',
    'dddddddd-dddd-dddd-dddd-dddddddddddd'
  )
);

select is(
  (select result ->> 'action' from nfc_test_results where key = 'stop'),
  'stop',
  'a new NFC event stops an open session'
);
select is(
  (select count(*)::integer from public.work_sessions where ended_at is null),
  0,
  'NFC stop closes the session'
);
select is(
  (select count(*)::integer from public.work_segments where ended_at is null),
  0,
  'NFC stop closes the active work segment'
);

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select ok(
  public.start_or_switch_work(null, null) is not null,
  'the browser start RPC still starts work'
);
select ok(
  public.stop_work() is not null,
  'the browser stop RPC still stops work'
);
select is(
  (select count(*)::integer from public.work_sessions where ended_at is null),
  0,
  'browser stop leaves no open session'
);

select * from finish();
rollback;
