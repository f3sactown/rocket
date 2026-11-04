-- A workout run again can be at another AO, so each extra run keeps its own date, AO, location
-- and time. This replaces the plain list of extra dates, carrying them over with the workout's
-- own AO.
alter table public.workouts
  add column if not exists runs jsonb not null default '[]'::jsonb;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workouts' and column_name = 'more_dates'
  ) then
    update public.workouts w
    set runs = (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('date', d, 'ao', w.ao, 'address', w.address, 'time', w.time)
          order by d
        ),
        '[]'::jsonb
      )
      from unnest(w.more_dates) as d
    )
    where cardinality(w.more_dates) > 0;

    alter table public.workouts drop column more_dates;
  end if;
end $$;
