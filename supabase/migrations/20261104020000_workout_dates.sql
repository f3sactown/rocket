-- A workout can be run again on other days: its first date stays in `date`, the rest are here.
-- Each date can have its own backblast.
alter table public.workouts
  add column if not exists more_dates date[] not null default '{}';
