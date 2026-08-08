-- Phase 3 work targets and deterministic todo ordering.
-- Existing timer functions remain available; this migration only adds the
-- transactional path required when a category or todo starts work.

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
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  perform public.lock_work_timer_user(v_user_id);

  if p_todo_id is not null then
    select category_id, status
    into v_todo_category_id, v_todo_status
    from public.todos
    where id = p_todo_id and user_id = v_user_id
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
      and user_id = v_user_id
      and archived = false
  ) then
    raise exception using errcode = '42501', message = 'active category does not belong to the authenticated user';
  end if;

  select id into v_session_id
  from public.work_sessions
  where user_id = v_user_id and ended_at is null
  for update;

  if v_session_id is null then
    insert into public.work_sessions (user_id, work_date, started_at)
    values (v_user_id, (v_now at time zone 'Asia/Tokyo')::date, v_now)
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
      where user_id = v_user_id
        and status = 'doing'
        and (p_todo_id is null or id <> p_todo_id);

      if p_todo_id is not null then
        update public.todos
        set status = 'doing', completed_at = null, updated_at = v_now
        where id = p_todo_id and user_id = v_user_id;
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
    v_user_id,
    v_session_id,
    v_category_id,
    p_todo_id,
    v_now
  );

  update public.todos
  set status = 'todo', completed_at = null, updated_at = v_now
  where user_id = v_user_id
    and status = 'doing'
    and (p_todo_id is null or id <> p_todo_id);

  if p_todo_id is not null then
    update public.todos
    set status = 'doing', completed_at = null, updated_at = v_now
    where id = p_todo_id and user_id = v_user_id;
  end if;

  return v_session_id;
end;
$$;

create or replace function public.reorder_todos(p_todo_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_scheduled_for date;
  v_index integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if coalesce(cardinality(p_todo_ids), 0) = 0 then
    return;
  end if;

  if (select count(distinct id) from unnest(p_todo_ids) as ids(id)) <> cardinality(p_todo_ids) then
    raise exception using errcode = '23514', message = 'todo order contains duplicate ids';
  end if;

  if (
    select count(*)
    from public.todos
    where user_id = v_user_id and id = any(p_todo_ids)
  ) <> cardinality(p_todo_ids) then
    raise exception using errcode = '42501', message = 'todo order contains an unowned id';
  end if;

  select min(scheduled_for) into v_scheduled_for
  from public.todos
  where user_id = v_user_id and id = any(p_todo_ids);

  if exists (
    select 1
    from public.todos
    where user_id = v_user_id
      and id = any(p_todo_ids)
      and scheduled_for <> v_scheduled_for
  ) then
    raise exception using errcode = '23514', message = 'todos from different dates cannot be reordered together';
  end if;

  for v_index in 1..cardinality(p_todo_ids) loop
    update public.todos
    set sort_order = v_index * 10, updated_at = statement_timestamp()
    where id = p_todo_ids[v_index] and user_id = v_user_id;
  end loop;
end;
$$;

-- Resume the previous category/todo instead of silently returning to uncategorized work.
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
  v_category_id uuid;
  v_todo_id uuid;
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

  select category_id, todo_id
  into v_category_id, v_todo_id
  from public.work_segments
  where work_session_id = v_session_id
  order by started_at desc
  limit 1;

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
    v_category_id,
    v_todo_id,
    v_now
  );

  return v_session_id;
end;
$$;

revoke all on function public.start_or_switch_work(uuid, uuid) from public, anon;
revoke all on function public.reorder_todos(uuid[]) from public, anon;

grant execute on function public.start_or_switch_work(uuid, uuid) to authenticated;
grant execute on function public.reorder_todos(uuid[]) to authenticated;
