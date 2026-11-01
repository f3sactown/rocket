-- Regions: each points at a Google Sheet with its AOs (sites), roster and attendance, plus which
-- tabs and columns hold that data. Anyone can read them (the sign-up screen lists them); signed-in
-- users can add one and change or remove the ones they added.
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  sheet_id text not null check (length(trim(sheet_id)) > 0),
  -- F3 or FiA: picking the region sets the user's wording and accent color to match.
  language text not null default 'f3' check (language in ('f3', 'fia')),
  -- { sites: { sheet, ao, address, location?, day?, time?, retired? },
  --   roster: { sheet, name },
  --   attendance: { sheet, date, ao, pax, post, q } }  (values are tab and column header names)
  config jsonb not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.regions enable row level security;

create policy "Anyone can read regions"
  on public.regions for select to anon, authenticated using (true);

create policy "Signed-in users can add regions"
  on public.regions for insert to authenticated
  with check ((select auth.uid()) = created_by);

create policy "Users can update regions they added"
  on public.regions for update to authenticated
  using ((select auth.uid()) = created_by) with check ((select auth.uid()) = created_by);

create policy "Users can delete regions they added"
  on public.regions for delete to authenticated
  using ((select auth.uid()) = created_by);

insert into public.regions (name, sheet_id, language, config, created_by) values (
  'F3 SacTown',
  '1_R4F0syR4m7eBen4j92PJCFeGrxEvNrbrL7LxFG46So',
  'f3',
  '{
    "sites": {
      "sheet": "Sites", "ao": "AO Name", "address": "Address", "location": "Location",
      "day": "Day", "time": "Time", "retired": "Retired"
    },
    "roster": { "sheet": "Roster", "name": "F3 Name" },
    "attendance": {
      "sheet": "Master Data", "date": "Post Date", "ao": "AO Name", "pax": "PAX Name",
      "post": "Post", "q": "Q"
    }
  }'::jsonb,
  null
);

-- Each user's home region.
alter table public.profiles
  add column region_id uuid references public.regions (id) on delete set null;

-- New users get the name and region they chose at sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  chosen text := new.raw_user_meta_data ->> 'region_id';
begin
  insert into public.profiles (id, name, region_id)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    (select r.id from public.regions r
      where chosen ~ '^[0-9a-fA-F-]{36}$' and r.id = chosen::uuid)
  );
  return new;
end;
$$;
