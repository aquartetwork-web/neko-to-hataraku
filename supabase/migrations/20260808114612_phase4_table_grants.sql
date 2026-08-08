-- Direct table access used by the application. Row visibility and write
-- ownership remain restricted by the existing authenticated RLS policies.
grant select on table public.work_sessions to authenticated;
grant select on table public.work_segments to authenticated;
grant select on table public.break_segments to authenticated;

grant select, insert, update on table public.settings to authenticated;
grant select, insert, update on table public.categories to authenticated;
grant select, insert, update on table public.todos to authenticated;
grant select, insert, update on table public.daily_notes to authenticated;
