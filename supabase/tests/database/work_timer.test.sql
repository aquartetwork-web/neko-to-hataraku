begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

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
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'phase2-timer@example.com',
  '',
  now(),
  now(),
  now()
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select ok(not has_table_privilege('public.work_sessions', 'INSERT'), 'authenticated cannot insert sessions directly');
select ok(not has_table_privilege('public.work_segments', 'UPDATE'), 'authenticated cannot update work segments directly');
select ok(not has_table_privilege('public.break_segments', 'DELETE'), 'authenticated cannot delete breaks directly');

create temporary table timer_test_state (
  key text primary key,
  session_id uuid not null
);

insert into timer_test_state values ('first', public.start_work());

select ok((select session_id is not null from timer_test_state where key = 'first'), 'start returns a session');
select is((select count(*)::integer from public.work_sessions where ended_at is null), 1, 'start creates one open session');
select is((select count(*)::integer from public.work_segments where ended_at is null), 1, 'start creates one open work segment');
select is((select count(*)::integer from public.break_segments where ended_at is null), 0, 'start creates no break');
select is(
  (select ws.started_at from public.work_sessions ws join public.work_segments seg on seg.work_session_id = ws.id where ws.id = (select session_id from timer_test_state where key = 'first')),
  (select seg.started_at from public.work_segments seg where seg.work_session_id = (select session_id from timer_test_state where key = 'first')),
  'session and first segment use the same server timestamp'
);
select is(
  (select work_date from public.work_sessions where id = (select session_id from timer_test_state where key = 'first')),
  (now() at time zone 'Asia/Tokyo')::date,
  'work date is labeled in Asia/Tokyo'
);
select is(public.start_work(), (select session_id from timer_test_state where key = 'first'), 'duplicate start is idempotent');
select is((select count(*)::integer from public.work_sessions where ended_at is null), 1, 'duplicate start keeps one open session');
select is((select count(*)::integer from public.work_segments), 1, 'duplicate start keeps one work segment');

select is(public.pause_work(), (select session_id from timer_test_state where key = 'first'), 'pause returns the session');
select is((select count(*)::integer from public.work_segments where ended_at is not null), 1, 'pause closes work');
select is((select count(*)::integer from public.break_segments where ended_at is null), 1, 'pause opens one break');
select is((select count(*)::integer from public.work_segments where ended_at is null), 0, 'pause leaves no open work');
select is(public.pause_work(), (select session_id from timer_test_state where key = 'first'), 'duplicate pause is idempotent');
select is((select count(*)::integer from public.break_segments), 1, 'duplicate pause keeps one break');

select is(public.resume_work(), (select session_id from timer_test_state where key = 'first'), 'resume returns the session');
select is((select count(*)::integer from public.break_segments where ended_at is not null), 1, 'resume closes the break');
select is((select count(*)::integer from public.work_segments where ended_at is null), 1, 'resume opens work');
select is(public.resume_work(), (select session_id from timer_test_state where key = 'first'), 'duplicate resume is idempotent');
select is((select count(*)::integer from public.work_segments), 2, 'duplicate resume keeps one resumed segment');

select is(public.stop_work(), (select session_id from timer_test_state where key = 'first'), 'stop returns the session');
select is((select count(*)::integer from public.work_sessions where ended_at is not null), 1, 'stop closes the session');
select is((select count(*)::integer from public.work_segments where ended_at is null), 0, 'stop closes work');
select is((select count(*)::integer from public.break_segments where ended_at is null), 0, 'stop leaves no break');
select is(public.stop_work(), null::uuid, 'duplicate stop is idempotent');

insert into timer_test_state values ('break-stop', public.start_work());
do $$
begin
  perform public.pause_work();
end;
$$;

select is(public.stop_work(), (select session_id from timer_test_state where key = 'break-stop'), 'stop during break returns the session');
select is(
  (select count(*)::integer from public.break_segments where work_session_id = (select session_id from timer_test_state where key = 'break-stop') and ended_at is not null),
  1,
  'stop during break closes the break'
);
select is((select count(*)::integer from public.work_sessions where ended_at is null), 0, 'stop during break closes the session');
select is(
  public.get_work_timer_state()->'session'->>'id',
  (select session_id::text from timer_test_state where key = 'break-stop'),
  'state RPC restores the latest completed session'
);

insert into timer_test_state values ('restored-open', public.start_work());

select is(
  public.get_work_timer_state()->'session'->>'id',
  (select session_id::text from timer_test_state where key = 'restored-open'),
  'state RPC restores an open session'
);
select is(jsonb_array_length(public.get_work_timer_state()->'work_segments'), 1, 'state RPC restores the open segment');
select is((public.get_work_timer_state()->>'daily_target_minutes')::integer, 360, 'state RPC returns the daily target');

select * from finish();
rollback;
