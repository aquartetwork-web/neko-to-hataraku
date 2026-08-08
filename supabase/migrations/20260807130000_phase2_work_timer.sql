-- Phase 2 work timer.
-- State transitions are intentionally exposed only through RPC functions so each
-- multi-row change is committed as one transaction.

create or replace function public.lock_work_timer_user(target_user_id uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_user_id::text, 0)
  );
$$;

create or replace function public.ensure_exclusive_open_segment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ended_at is not null then
    return new;
  end if;

  perform public.lock_work_timer_user(new.user_id);

  if tg_table_name = 'work_segments' and exists (
    select 1
    from public.break_segments
    where work_session_id = new.work_session_id
      and ended_at is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'an open work segment and break segment cannot coexist';
  end if;

  if tg_table_name = 'break_segments' and exists (
    select 1
    from public.work_segments
    where work_session_id = new.work_session_id
      and ended_at is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'an open work segment and break segment cannot coexist';
  end if;

  return new;
end;
$$;

create trigger work_segments_ensure_exclusive_open
before insert or update of ended_at, work_session_id, user_id on public.work_segments
for each row execute function public.ensure_exclusive_open_segment();

create trigger break_segments_ensure_exclusive_open
before insert or update of ended_at, work_session_id, user_id on public.break_segments
for each row execute function public.ensure_exclusive_open_segment();

create or replace function public.start_work()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_session_id uuid;
  v_open_work_count integer;
  v_open_break_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  perform public.lock_work_timer_user(v_user_id);

  select id into v_session_id
  from public.work_sessions
  where user_id = v_user_id and ended_at is null
  for update;

  if v_session_id is not null then
    select count(*) into v_open_work_count
    from public.work_segments
    where work_session_id = v_session_id and ended_at is null;

    select count(*) into v_open_break_count
    from public.break_segments
    where work_session_id = v_session_id and ended_at is null;

    if (v_open_work_count = 1 and v_open_break_count = 0)
      or (v_open_work_count = 0 and v_open_break_count = 1) then
      return v_session_id;
    end if;

    raise exception using errcode = '23514', message = 'open work session has an invalid segment state';
  end if;

  insert into public.work_sessions (user_id, work_date, started_at)
  values (v_user_id, (v_now at time zone 'Asia/Tokyo')::date, v_now)
  returning id into v_session_id;

  insert into public.work_segments (
    user_id,
    work_session_id,
    category_id,
    todo_id,
    started_at
  ) values (
    v_user_id,
    v_session_id,
    null,
    null,
    v_now
  );

  return v_session_id;
end;
$$;

create or replace function public.pause_work()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_session_id uuid;
  v_work_segment_id uuid;
  v_break_segment_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  perform public.lock_work_timer_user(v_user_id);

  select id into v_session_id
  from public.work_sessions
  where user_id = v_user_id and ended_at is null
  for update;

  if v_session_id is null then
    raise exception using errcode = 'P0001', message = 'no open work session';
  end if;

  select id into v_work_segment_id
  from public.work_segments
  where work_session_id = v_session_id and ended_at is null
  for update;

  select id into v_break_segment_id
  from public.break_segments
  where work_session_id = v_session_id and ended_at is null
  for update;

  if v_work_segment_id is null and v_break_segment_id is not null then
    return v_session_id;
  end if;

  if v_work_segment_id is null or v_break_segment_id is not null then
    raise exception using errcode = '23514', message = 'work session cannot transition to break';
  end if;

  update public.work_segments
  set ended_at = v_now, updated_at = v_now
  where id = v_work_segment_id;

  insert into public.break_segments (user_id, work_session_id, started_at)
  values (v_user_id, v_session_id, v_now);

  return v_session_id;
end;
$$;

create or replace function public.resume_work()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_session_id uuid;
  v_work_segment_id uuid;
  v_break_segment_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  perform public.lock_work_timer_user(v_user_id);

  select id into v_session_id
  from public.work_sessions
  where user_id = v_user_id and ended_at is null
  for update;

  if v_session_id is null then
    raise exception using errcode = 'P0001', message = 'no open work session';
  end if;

  select id into v_work_segment_id
  from public.work_segments
  where work_session_id = v_session_id and ended_at is null
  for update;

  select id into v_break_segment_id
  from public.break_segments
  where work_session_id = v_session_id and ended_at is null
  for update;

  if v_work_segment_id is not null and v_break_segment_id is null then
    return v_session_id;
  end if;

  if v_work_segment_id is not null or v_break_segment_id is null then
    raise exception using errcode = '23514', message = 'work session cannot resume';
  end if;

  update public.break_segments
  set ended_at = v_now, updated_at = v_now
  where id = v_break_segment_id;

  insert into public.work_segments (
    user_id,
    work_session_id,
    category_id,
    todo_id,
    started_at
  ) values (
    v_user_id,
    v_session_id,
    null,
    null,
    v_now
  );

  return v_session_id;
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
  v_now timestamptz := clock_timestamp();
  v_session_id uuid;
  v_work_segment_id uuid;
  v_break_segment_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  perform public.lock_work_timer_user(v_user_id);

  select id into v_session_id
  from public.work_sessions
  where user_id = v_user_id and ended_at is null
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

create or replace function public.get_work_timer_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  v_today_start timestamptz;
  v_tomorrow_start timestamptz;
  v_session public.work_sessions%rowtype;
  v_target_minutes integer;
  v_work_segments jsonb := '[]'::jsonb;
  v_break_segments jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  v_today_start := date_trunc('day', v_now at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';
  v_tomorrow_start := v_today_start + interval '1 day';

  select coalesce(daily_target_minutes, 360)
  into v_target_minutes
  from public.settings
  where user_id = v_user_id;

  v_target_minutes := coalesce(v_target_minutes, 360);

  select * into v_session
  from public.work_sessions
  where user_id = v_user_id and ended_at is null
  order by started_at desc
  limit 1;

  if v_session.id is null then
    select * into v_session
    from public.work_sessions
    where user_id = v_user_id
      and started_at < v_tomorrow_start
      and ended_at >= v_today_start
    order by ended_at desc
    limit 1;
  end if;

  if v_session.id is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'started_at', started_at,
          'ended_at', ended_at,
          'category_id', category_id,
          'todo_id', todo_id
        ) order by started_at
      ),
      '[]'::jsonb
    ) into v_work_segments
    from public.work_segments
    where work_session_id = v_session.id;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'started_at', started_at,
          'ended_at', ended_at
        ) order by started_at
      ),
      '[]'::jsonb
    ) into v_break_segments
    from public.break_segments
    where work_session_id = v_session.id;
  end if;

  return jsonb_build_object(
    'server_now', v_now,
    'daily_target_minutes', v_target_minutes,
    'session', case
      when v_session.id is null then null
      else jsonb_build_object(
        'id', v_session.id,
        'work_date', v_session.work_date,
        'started_at', v_session.started_at,
        'ended_at', v_session.ended_at
      )
    end,
    'work_segments', v_work_segments,
    'break_segments', v_break_segments
  );
end;
$$;

-- Authenticated clients may read their rows through RLS, but timer writes must go
-- through the transactional functions above.
revoke insert, update, delete on public.work_sessions from anon, authenticated;
revoke insert, update, delete on public.work_segments from anon, authenticated;
revoke insert, update, delete on public.break_segments from anon, authenticated;

revoke all on function public.lock_work_timer_user(uuid) from public, anon, authenticated;
revoke all on function public.start_work() from public, anon;
revoke all on function public.pause_work() from public, anon;
revoke all on function public.resume_work() from public, anon;
revoke all on function public.stop_work() from public, anon;
revoke all on function public.get_work_timer_state() from public, anon;

grant execute on function public.start_work() to authenticated;
grant execute on function public.pause_work() to authenticated;
grant execute on function public.resume_work() to authenticated;
grant execute on function public.stop_work() to authenticated;
grant execute on function public.get_work_timer_state() to authenticated;
