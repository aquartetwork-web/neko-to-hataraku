begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

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
  'phase3-targets@example.com',
  '',
  now(),
  now(),
  now()
);

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

create temporary table target_test_state (
  key text primary key,
  value uuid not null
);

insert into public.todos (title, scheduled_for, category_id, sort_order)
select '最初のToDo', current_date, id, 10
from public.categories
where name = 'シナリオ執筆';

insert into public.todos (title, scheduled_for, category_id, sort_order)
select '次のToDo', current_date, id, 20
from public.categories
where name = 'Notion';

insert into public.todos (title, scheduled_for, sort_order)
values ('最後のToDo', current_date, 30);

insert into target_test_state (key, value)
select 'session', public.start_or_switch_work(category_id, id)
from public.todos
where title = '最初のToDo';

select ok((select value is not null from target_test_state where key = 'session'), 'todo start returns a session');
select is((select count(*)::integer from public.work_sessions where ended_at is null), 1, 'todo start creates one open session');
select is((select todo_id from public.work_segments where ended_at is null), (select id from public.todos where title = '最初のToDo'), 'open segment targets the todo');
select is((select category_id from public.work_segments where ended_at is null), (select category_id from public.todos where title = '最初のToDo'), 'todo category is inherited');
select is((select status::text from public.todos where title = '最初のToDo'), 'doing', 'started todo becomes doing');
select is(
  public.start_or_switch_work(null, (select id from public.todos where title = '最初のToDo')),
  (select value from target_test_state where key = 'session'),
  'duplicate todo start is idempotent'
);
select is((select count(*)::integer from public.work_segments), 1, 'duplicate start does not add a segment');

select is(
  public.start_or_switch_work((select id from public.categories where name = 'Notion'), null),
  (select value from target_test_state where key = 'session'),
  'category switch keeps the session'
);
select is((select count(*)::integer from public.work_segments where ended_at is null), 1, 'category switch keeps one open work segment');
select is((select count(*)::integer from public.work_segments where ended_at is not null), 1, 'category switch closes prior work');
select is((select status::text from public.todos where title = '最初のToDo'), 'todo', 'category switch clears previous doing todo');

select is(public.pause_work(), (select value from target_test_state where key = 'session'), 'pause still works after switching');
select is((select count(*)::integer from public.break_segments where ended_at is null), 1, 'pause opens one break');
select is(public.resume_work(), (select value from target_test_state where key = 'session'), 'resume still works after switching');
select is(
  (select category_id from public.work_segments where ended_at is null),
  (select id from public.categories where name = 'Notion'),
  'resume preserves the previous category'
);
select is(public.stop_work(), (select value from target_test_state where key = 'session'), 'stop closes targeted work');

select public.reorder_todos(array(
  select id from public.todos order by sort_order desc
));
select is(
  (select string_agg(title, ',' order by sort_order) from public.todos),
  '最後のToDo,次のToDo,最初のToDo',
  'reorder stores the requested order'
);

update public.categories set archived = true where name = 'シナリオ執筆';
select is((select count(*)::integer from public.categories where name = 'シナリオ執筆' and archived), 1, 'category can be archived');
select is(
  (select count(*)::integer from public.work_segments where category_id = (select id from public.categories where name = 'シナリオ執筆')),
  1,
  'archiving preserves historical work references'
);

select * from finish();
rollback;
