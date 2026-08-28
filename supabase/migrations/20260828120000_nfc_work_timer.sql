-- NFC work timer bridge.
--
-- The browser and NFC entry points both delegate to the same private timer
-- transition functions. NFC callers only receive permission to invoke the
-- narrow toggle RPC after presenting a matching tag and device token pair.

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated, service_role;

create table app_private.nfc_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default 'PaSoRi',
  tag_id_hash text not null unique
    check (tag_id_hash ~ '^[0-9a-f]{64}$'),
  device_token_hash text not null unique
    check (device_token_hash ~ '^[0-9a-f]{64}$'),
  enabled boolean not null default true,
  last_event_id uuid,
  last_result jsonb,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table app_private.nfc_devices from public, anon, authenticated, service_role;

create or replace function app_private.start_or_switch_work_for_user(
  p_user_id uuid,
  p_category_id uuid default null,
  p_todo_id uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_session_id uuid;
  v_open_work_id uuid;
  v_open_break_id uuid;
  v_current_category_id uuid;
  v_current_todo_id uuid;
  v_category_id uuid := p_category_id;
  v_todo_category_id uuid;
  v_todo_status public.todo_status;
begin
  if p_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  perform public.lock_work_timer_user(p_user_id);

  if p_todo_id is not null then
    select category_id, status
    into v_todo_category_id, v_todo_status
    from public.todos
    where id = p_todo_id and user_id = p_user_id
    for update;

    if not found then
      raise exception using errcode = '42501', message = 'todo does not belong to the authenticated user';
    end if;

    if v_todo_status = 'done' then
      raise exception using errcode = '23514', message = 'a completed todo cannot be started';
    end if;

    v_category_id := v_todo_category_id;
  end if;

  if v_category_id is not null and not exists (
    select 1
    from public.categories
    where id = v_category_id
      and user_id = p_user_id
      and archived = false
  ) then
    raise exception using errcode = '42501', message = 'active category does not belong to the authenticated user';
  end if;

  select id into v_session_id
  from public.work_sessions
  where user_id = p_user_id and ended_at is null
  for update;

  if v_session_id is null then
    insert into public.work_sessions (user_id, work_date, started_at)
    values (p_user_id, (v_now at time zone 'Asia/Tokyo')::date, v_now)
    returning id into v_session_id;
  else
    select id, category_id, todo_id
    into v_open_work_id, v_current_category_id, v_current_todo_id
    from public.work_segments
    where work_session_id = v_session_id and ended_at is null
    for update;

    select id into v_open_break_id
    from public.break_segments
    where work_session_id = v_session_id and ended_at is null
    for update;

    if v_open_work_id is not null and v_open_break_id is not null then
      raise exception using errcode = '23514', message = 'open work session has simultaneous work and break segments';
    end if;

    if v_open_work_id is null and v_open_break_id is null then
      raise exception using errcode = '23514', message = 'open work session has no active segment';
    end if;

    if v_open_work_id is not null
      and v_current_category_id is not distinct from v_category_id
      and v_current_todo_id is not distinct from p_todo_id then
      update public.todos
      set status = 'todo', completed_at = null, updated_at = v_now
      where user_id = p_user_id
        and status = 'doing'
        and (p_todo_id is null or id <> p_todo_id);

      if p_todo_id is not null then
        update public.todos
        set status = 'doing', completed_at = null, updated_at = v_now
        where id = p_todo_id and user_id = p_user_id;
      end if;

      return v_session_id;
    end if;

    if v_open_work_id is not null then
      update public.work_segments
      set ended_at = v_now, updated_at = v_now
      where id = v_open_work_id;
    else
      update public.break_segments
      set ended_at = v_now, updated_at = v_now
      where id = v_open_break_id;
    end if;
  end if;

  insert into public.work_segments (
    user_id,
    work_session_id,
    category_id,
    todo_id,
    started_at
  ) values (
    p_user_id,
    v_session_id,
    v_category_id,
    p_todo_id,
    v_now
  );

  update public.todos
  set status = 'todo', completed_at = null, updated_at = v_now
  where user_id = p_user_id
    and status = 'doing'
    and (p_todo_id is null or id <> p_todo_id);

  if p_todo_id is not null then
    update public.todos
    set status = 'doing', completed_at = null, updated_at = v_now
    where id = p_todo_id and user_id = p_user_id;
  end if;

  return v_session_id;
end;
$$;

create or replace function app_private.stop_work_for_user(p_user_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_session_id uuid;
  v_work_segment_id uuid;
  v_break_segment_id uuid;
begin
  if p_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  perform public.lock_work_timer_user(p_user_id);

  select id into v_session_id
  from public.work_sessions
  where user_id = p_user_id and ended_at is null
  for update;

  if v_session_id is null then
    return null;
  end if;

  select id into v_work_segment_id
  from public.work_segments
  where work_session_id = v_session_id and ended_at is null
  for update;

  select id into v_break_segment_id
  from public.break_segments
  where work_session_id = v_session_id and ended_at is null
  for update;

  if (v_work_segment_id is null and v_break_segment_id is null)
    or (v_work_segment_id is not null and v_break_segment_id is not null) then
    raise exception using errcode = '23514', message = 'open work session has an invalid segment state';
  end if;

  if v_work_segment_id is not null then
    update public.work_segments
    set ended_at = v_now, updated_at = v_now
    where id = v_work_segment_id;
  else
    update public.break_segments
    set ended_at = v_now, updated_at = v_now
    where id = v_break_segment_id;
  end if;

  update public.work_sessions
  set ended_at = v_now, updated_at = v_now
  where id = v_session_id;

  return v_session_id;
end;
$$;

revoke all on function app_private.start_or_switch_work_for_user(uuid, uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function app_private.stop_work_for_user(uuid)
from public, anon, authenticated, service_role;

-- Keep the browser-facing RPC names and behavior unchanged while delegating the
-- data mutation to the shared private implementation above.
create or replace function public.start_or_switch_work(
  p_category_id uuid default null,
  p_todo_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return app_private.start_or_switch_work_for_user(
    v_user_id,
    p_category_id,
    p_todo_id
  );
end;
$$;

create or replace function public.stop_work()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return app_private.stop_work_for_user(v_user_id);
end;
$$;

create or replace function public.toggle_work_via_nfc(
  p_tag_id text,
  p_device_token text,
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag_id text := pg_catalog.upper(
    pg_catalog.regexp_replace(coalesce(p_tag_id, ''), '[^0-9A-Fa-f]', '', 'g')
  );
  v_device app_private.nfc_devices%rowtype;
  v_session_id uuid;
  v_action text;
  v_message text;
  v_now timestamptz;
  v_result jsonb;
begin
  if p_event_id is null then
    raise exception using errcode = '22023', message = 'event id is required';
  end if;

  if pg_catalog.length(v_tag_id) < 8
    or pg_catalog.length(v_tag_id) > 32
    or pg_catalog.length(v_tag_id) % 2 <> 0 then
    raise exception using errcode = '22023', message = 'invalid NFC tag id';
  end if;

  if pg_catalog.length(coalesce(p_device_token, '')) < 32 then
    raise exception using errcode = '42501', message = 'NFC credential rejected';
  end if;

  select * into v_device
  from app_private.nfc_devices
  where enabled = true
    and tag_id_hash = pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(v_tag_id, 'UTF8')),
      'hex'
    )
    and device_token_hash = pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(p_device_token, 'UTF8')),
      'hex'
    )
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'NFC credential rejected';
  end if;

  if v_device.last_event_id = p_event_id and v_device.last_result is not null then
    return v_device.last_result || pg_catalog.jsonb_build_object('duplicate', true);
  end if;

  perform public.lock_work_timer_user(v_device.user_id);

  if exists (
    select 1
    from public.work_sessions
    where user_id = v_device.user_id and ended_at is null
  ) then
    v_session_id := app_private.stop_work_for_user(v_device.user_id);
    v_action := 'stop';
    v_message := '退勤しました';
  else
    v_session_id := app_private.start_or_switch_work_for_user(
      v_device.user_id,
      null,
      null
    );
    v_action := 'start';
    v_message := '出勤しました';
  end if;

  v_now := clock_timestamp();
  v_result := pg_catalog.jsonb_build_object(
    'action', v_action,
    'message', v_message,
    'session_id', v_session_id,
    'occurred_at', v_now,
    'duplicate', false
  );

  update app_private.nfc_devices
  set last_event_id = p_event_id,
      last_result = v_result,
      last_used_at = v_now,
      updated_at = v_now
  where id = v_device.id;

  return v_result;
end;
$$;

revoke all on function public.start_or_switch_work(uuid, uuid) from public, anon;
revoke all on function public.stop_work() from public, anon;
revoke all on function public.toggle_work_via_nfc(text, text, uuid)
from public, authenticated, service_role;

grant execute on function public.start_or_switch_work(uuid, uuid) to authenticated;
grant execute on function public.stop_work() to authenticated;
grant execute on function public.toggle_work_via_nfc(text, text, uuid) to anon;
