create type public.todo_status as enum ('todo', 'doing', 'done');
create type public.category_color as enum ('main', 'cyan', 'yellow', 'pink', 'purple', 'gray');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  app_name text not null default 'ねことはたらく' check (length(trim(app_name)) between 1 and 40),
  timezone text not null default 'Asia/Tokyo',
  daily_minimum_minutes integer not null default 240 check (daily_minimum_minutes between 0 and 1440),
  daily_target_minutes integer not null default 360 check (daily_target_minutes between 1 and 1440),
  weekly_target_minutes integer not null default 1800 check (weekly_target_minutes between 1 and 10080),
  cat_name text not null default 'ねこ屋さん' check (length(trim(cat_name)) between 1 and 40),
  cat_variant text not null default 'white',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settings_minimum_not_above_target check (daily_minimum_minutes <= daily_target_minutes)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  color_key public.category_color not null default 'main',
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240),
  scheduled_for date not null,
  category_id uuid references public.categories (id) on delete set null,
  status public.todo_status not null default 'todo',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint todos_completed_state check (
    (status = 'done' and completed_at is not null)
    or (status <> 'done' and completed_at is null)
  )
);

create table public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_date date not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_sessions_valid_range check (ended_at is null or ended_at >= started_at),
  unique (id, user_id)
);

comment on column public.work_sessions.work_date is
  'Logical workday label. Reports must calculate overlap from timestamps and Asia/Tokyo calendar boundaries; never assign the full duration solely by this value.';

create table public.work_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_session_id uuid not null,
  category_id uuid references public.categories (id) on delete set null,
  todo_id uuid references public.todos (id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_segments_valid_range check (ended_at is null or ended_at >= started_at),
  constraint work_segments_owned_session
    foreign key (work_session_id, user_id)
    references public.work_sessions (id, user_id)
    on delete cascade
);

create table public.break_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_session_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint break_segments_valid_range check (ended_at is null or ended_at >= started_at),
  constraint break_segments_owned_session
    foreign key (work_session_id, user_id)
    references public.work_sessions (id, user_id)
    on delete cascade
);

create table public.daily_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_date date not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, note_date)
);

create unique index categories_active_name_key
  on public.categories (user_id, lower(name))
  where archived = false;

create index categories_user_sort_idx on public.categories (user_id, archived, sort_order);
create index todos_user_date_sort_idx on public.todos (user_id, scheduled_for, sort_order);
create index todos_category_idx on public.todos (category_id) where category_id is not null;
create index work_sessions_user_started_idx on public.work_sessions (user_id, started_at desc);
create unique index work_sessions_one_open_per_user_idx
  on public.work_sessions (user_id)
  where ended_at is null;
create index work_segments_session_started_idx on public.work_segments (work_session_id, started_at);
create unique index work_segments_one_open_per_session_idx
  on public.work_segments (work_session_id)
  where ended_at is null;
create index break_segments_session_started_idx on public.break_segments (work_session_id, started_at);
create unique index break_segments_one_open_per_session_idx
  on public.break_segments (work_session_id)
  where ended_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_owned_references()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'todos' and new.category_id is not null then
    if not exists (
      select 1 from public.categories
      where id = new.category_id and user_id = new.user_id
    ) then
      raise exception 'category must belong to the same user';
    end if;
  end if;

  if tg_table_name = 'work_segments' then
    if new.category_id is not null and not exists (
      select 1 from public.categories
      where id = new.category_id and user_id = new.user_id
    ) then
      raise exception 'category must belong to the same user';
    end if;

    if new.todo_id is not null and not exists (
      select 1 from public.todos
      where id = new.todo_id and user_id = new.user_id
    ) then
      raise exception 'todo must belong to the same user';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''));

  insert into public.settings (user_id)
  values (new.id);

  insert into public.categories (user_id, name, color_key, sort_order)
  values
    (new.id, 'シナリオ執筆', 'purple', 10),
    (new.id, 'Notion', 'cyan', 20),
    (new.id, 'SNS投稿作り', 'pink', 30),
    (new.id, '事務作業', 'yellow', 40),
    (new.id, 'その他', 'gray', 50);

  return new;
end;
$$;

insert into public.profiles (id, display_name)
select id, nullif(trim(raw_user_meta_data ->> 'display_name'), '')
from auth.users
on conflict (id) do nothing;

insert into public.settings (user_id)
select id
from auth.users
on conflict (user_id) do nothing;

insert into public.categories (user_id, name, color_key, sort_order)
select users.id, defaults.name, defaults.color_key, defaults.sort_order
from auth.users as users
cross join (
  values
    ('シナリオ執筆', 'purple'::public.category_color, 10),
    ('Notion', 'cyan'::public.category_color, 20),
    ('SNS投稿作り', 'pink'::public.category_color, 30),
    ('事務作業', 'yellow'::public.category_color, 40),
    ('その他', 'gray'::public.category_color, 50)
) as defaults (name, color_key, sort_order)
where not exists (
  select 1 from public.categories where categories.user_id = users.id
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();
create trigger todos_set_updated_at
before update on public.todos
for each row execute function public.set_updated_at();
create trigger work_sessions_set_updated_at
before update on public.work_sessions
for each row execute function public.set_updated_at();
create trigger work_segments_set_updated_at
before update on public.work_segments
for each row execute function public.set_updated_at();
create trigger break_segments_set_updated_at
before update on public.break_segments
for each row execute function public.set_updated_at();
create trigger daily_notes_set_updated_at
before update on public.daily_notes
for each row execute function public.set_updated_at();

create trigger todos_validate_owned_references
before insert or update of user_id, category_id on public.todos
for each row execute function public.validate_owned_references();
create trigger work_segments_validate_owned_references
before insert or update of user_id, category_id, todo_id on public.work_segments
for each row execute function public.validate_owned_references();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.todos enable row level security;
alter table public.work_sessions enable row level security;
alter table public.work_segments enable row level security;
alter table public.break_segments enable row level security;
alter table public.daily_notes enable row level security;

create policy "Users manage their own profile"
on public.profiles for all
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users manage their own settings"
on public.settings for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their own categories"
on public.categories for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their own todos"
on public.todos for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their own work sessions"
on public.work_sessions for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their own work segments"
on public.work_segments for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their own break segments"
on public.break_segments for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their own daily notes"
on public.daily_notes for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
