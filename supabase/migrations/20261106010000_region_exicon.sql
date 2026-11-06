-- A third Library source: each region's own exercises and routines, from an optional "Exicon" tab
-- in its Google Sheet (Name, Category, Tags, Description, Author). The nightly region sync copies
-- it in; each entry records its region, and a region's entries are replaced on their own.
alter table public.exicon_entries
  drop constraint if exists exicon_entries_source_check;
alter table public.exicon_entries
  add constraint exicon_entries_source_check check (source in ('f3', 'fia', 'region'));

alter table public.exicon_entries
  add column if not exists region_id uuid references public.regions (id) on delete cascade;

create index if not exists exicon_entries_region_idx on public.exicon_entries (region_id);

create or replace function public.replace_region_exicon(p_region uuid, p_entries jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.exicon_entries where source = 'region' and region_id = p_region;
  insert into public.exicon_entries
    (id, source, region_id, name, description, aliases, tags, is_routine, video_url, url)
  select
    e ->> 'id',
    'region',
    p_region,
    e ->> 'name',
    coalesce(e ->> 'description', ''),
    '{}',
    coalesce(array(select jsonb_array_elements_text(e -> 'tags')), '{}'),
    coalesce((e ->> 'is_routine')::boolean, false),
    nullif(e ->> 'video_url', ''),
    e ->> 'url'
  from jsonb_array_elements(p_entries) as e;
end;
$$;

-- Only the sync job (service role) may replace a region's entries.
revoke execute on function public.replace_region_exicon(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_region_exicon(uuid, jsonb) to service_role;
