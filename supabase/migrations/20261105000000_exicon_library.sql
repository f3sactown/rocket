-- The exercise and routine library: a weekly copy of F3 Nation's Exicon (codex.f3nation.com),
-- shown when writing a workout's Warm-o-rama and The Thang. Read-only in the app; the sync job
-- replaces it with the service-role key.
create table if not exists public.exicon_entries (
  id text primary key,
  name text not null,
  -- The description as plain text (the Codex stores formatted HTML).
  description text not null default '',
  aliases text[] not null default '{}',
  tags text[] not null default '{}',
  -- Tagged "Routine" on the Codex; anything else is an exercise.
  is_routine boolean not null default false,
  video_url text,
  -- The entry's page on the Codex.
  url text not null,
  synced_at timestamptz not null default now()
);

create index if not exists exicon_entries_name_idx on public.exicon_entries (lower(name));

alter table public.exicon_entries enable row level security;

create policy "Signed-in users can read the library"
  on public.exicon_entries for select to authenticated
  using (true);

-- Replaces the whole library in one transaction, so the app never sees it half-written.
create or replace function public.replace_exicon_entries(p_entries jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.exicon_entries where true;
  insert into public.exicon_entries (id, name, description, aliases, tags, is_routine, video_url, url)
  select
    e ->> 'id',
    e ->> 'name',
    coalesce(e ->> 'description', ''),
    coalesce(array(select jsonb_array_elements_text(e -> 'aliases')), '{}'),
    coalesce(array(select jsonb_array_elements_text(e -> 'tags')), '{}'),
    coalesce((e ->> 'is_routine')::boolean, false),
    nullif(e ->> 'video_url', ''),
    e ->> 'url'
  from jsonb_array_elements(p_entries) as e;
end;
$$;

-- Only the sync job (service role) may replace the library.
revoke execute on function public.replace_exicon_entries(jsonb) from public, anon, authenticated;
grant execute on function public.replace_exicon_entries(jsonb) to service_role;
