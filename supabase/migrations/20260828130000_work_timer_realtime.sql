-- Publish only the tables that can change the current work timer snapshot.
do $$
declare
  timer_table text;
begin
  foreach timer_table in array array[
    'work_sessions',
    'work_segments',
    'break_segments'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = timer_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        timer_table
      );
    end if;
  end loop;
end;
$$;
