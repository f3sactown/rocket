-- The Library has two sources: F3 Nation's Exicon (the F3 Codex) and FiA's Exicon (a Google
-- Sheet). Each entry records which one it came from, and each source is replaced on its own, so
-- one failing to load leaves the other alone.
alter table public.exicon_entries
  add column if not exists source text not null default 'f3' check (source in ('f3', 'fia'));

drop function if exists public.replace_exicon_entries(jsonb);

create or replace function public.replace_exicon_entries(p_source text, p_entries jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.exicon_entries where source = p_source;
  insert into public.exicon_entries
    (id, source, name, description, aliases, tags, is_routine, video_url, url)
  select
    e ->> 'id',
    p_source,
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
revoke execute on function public.replace_exicon_entries(text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_exicon_entries(text, jsonb) to service_role;
