-- Nightly copy of each region's Google Sheet data, written by .github/workflows/sync-regions.yml.
-- The app reads these instead of the sheet once a region has synced. Only the sync job (using the
-- service-role key) writes them; signed-in users can read them.

alter table public.regions
  add column synced_at timestamptz,
  add column sync_error text;

create table public.region_sites (
  region_id uuid not null references public.regions (id) on delete cascade,
  name text not null,
  address text not null default '',
  day text not null default '',
  time text not null default '',
  primary key (region_id, name)
);

create table public.region_roster (
  region_id uuid not null references public.regions (id) on delete cascade,
  name text not null,
  primary key (region_id, name)
);

-- Posts per PAX per AO over the last few months, for the "regulars" suggestions.
create table public.region_regulars (
  region_id uuid not null references public.regions (id) on delete cascade,
  ao text not null,
  pax text not null,
  posts integer not null,
  primary key (region_id, ao, pax)
);

-- All-time totals per PAX.
create table public.region_pax_stats (
  region_id uuid not null references public.regions (id) on delete cascade,
  pax text not null,
  posts integer not null default 0,
  qs integer not null default 0,
  primary key (region_id, pax)
);

alter table public.region_sites enable row level security;
alter table public.region_roster enable row level security;
alter table public.region_regulars enable row level security;
alter table public.region_pax_stats enable row level security;

create policy "Signed-in users can read region sites"
  on public.region_sites for select to authenticated using (true);
create policy "Signed-in users can read region rosters"
  on public.region_roster for select to authenticated using (true);
create policy "Signed-in users can read region regulars"
  on public.region_regulars for select to authenticated using (true);
create policy "Signed-in users can read region totals"
  on public.region_pax_stats for select to authenticated using (true);

-- Replaces one region's synced data in a single transaction, so readers never see it half-written.
create function public.replace_region_data(
  p_region uuid,
  p_sites jsonb,
  p_roster jsonb,
  p_regulars jsonb,
  p_stats jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.region_sites where region_id = p_region;
  delete from public.region_roster where region_id = p_region;
  delete from public.region_regulars where region_id = p_region;
  delete from public.region_pax_stats where region_id = p_region;

  insert into public.region_sites (region_id, name, address, day, time)
    select p_region, name, coalesce(address, ''), coalesce(day, ''), coalesce(time, '')
    from jsonb_to_recordset(p_sites) as x(name text, address text, day text, time text);
  insert into public.region_roster (region_id, name)
    select p_region, name from jsonb_to_recordset(p_roster) as x(name text);
  insert into public.region_regulars (region_id, ao, pax, posts)
    select p_region, ao, pax, posts
    from jsonb_to_recordset(p_regulars) as x(ao text, pax text, posts integer);
  insert into public.region_pax_stats (region_id, pax, posts, qs)
    select p_region, pax, coalesce(posts, 0), coalesce(qs, 0)
    from jsonb_to_recordset(p_stats) as x(pax text, posts integer, qs integer);

  update public.regions set synced_at = now(), sync_error = null where id = p_region;
end;
$$;

-- Notes why a region's last sync failed (its previous data is kept).
create function public.record_region_sync_error(p_region uuid, p_error text)
returns void
language sql
set search_path = ''
as $$
  update public.regions set sync_error = p_error where id = p_region;
$$;

-- Only the sync job may call these.
revoke execute on function public.replace_region_data(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.record_region_sync_error(uuid, text) from public, anon, authenticated;
grant execute on function public.replace_region_data(uuid, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.record_region_sync_error(uuid, text) to service_role;
