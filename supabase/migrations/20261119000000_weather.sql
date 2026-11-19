-- Weather for workouts and backblasts.
--
-- Where each AO is, for its weather: the nightly region sync looks each AO's address up once
-- (US Census geocoder, then OpenStreetMap) and keeps it here, keyed by the address as Rocket
-- stores it (trimmed, single-spaced, lower case). An address that couldn't be found is kept with
-- no coordinates, so it isn't looked up again every night (it's tried again after 30 days).
create table if not exists public.place_coordinates (
  address text primary key,
  latitude double precision,
  longitude double precision,
  looked_up_at timestamptz not null default now()
);

alter table public.place_coordinates enable row level security;

drop policy if exists "Signed-in users can read place coordinates" on public.place_coordinates;
create policy "Signed-in users can read place coordinates"
  on public.place_coordinates for select to authenticated using (true);

-- Only the sync job writes them (with the service role, which RLS doesn't hold back).
grant select on public.place_coordinates to authenticated;

-- A backblast's Conditions: the weather at the AO when it ran, filled in from Open-Meteo and
-- changeable. Its own, not shared with its workout.
alter table public.backblasts
  add column if not exists weather text;
