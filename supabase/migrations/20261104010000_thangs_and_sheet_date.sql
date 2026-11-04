-- A workout can have several thangs, each with an optional timer for the Run workout screen.
-- `thang` keeps the written-out text, which backblasts copy and the output uses.
alter table public.workouts
  add column if not exists thangs jsonb not null default '[]'::jsonb;

update public.workouts
set thangs = jsonb_build_array(jsonb_build_object('text', thang))
where thangs = '[]'::jsonb and thang is not null and thang <> '';

-- The most recent post date in a region's attendance records, saved by the nightly sync, so the
-- app can say how current the sheet is.
alter table public.regions
  add column if not exists latest_post_on date;
