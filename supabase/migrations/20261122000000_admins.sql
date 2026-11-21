-- Admins: who can manage Rocket from its Admin page (people's names and regions, the regions
-- themselves, and who else is an admin). The first admin is added by hand in the SQL Editor:
--   insert into public.admins (user_id) select id from auth.users where email = '…';
-- After that, admins add and remove admins on the Admin page. Every change is logged.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Whether someone (the signed-in user, by default) is an admin. Anyone signed in may ask about
-- themselves; the app shows the Admin page only to admins.
create or replace function public.is_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = p_user);
$$;

revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

drop policy if exists "Admins can see the admins" on public.admins;
create policy "Admins can see the admins"
  on public.admins for select to authenticated using (public.is_admin());
-- No insert, update or delete policies: admins are added and removed with admin_set_admin.

-- What admins have changed, newest first on the Admin page.
create table if not exists public.admin_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  target text not null default '',
  details jsonb not null default '{}'::jsonb
);

alter table public.admin_log enable row level security;

drop policy if exists "Admins can read the admin log" on public.admin_log;
create policy "Admins can read the admin log"
  on public.admin_log for select to authenticated using (public.is_admin());

-- Notes a change in the log (only from the functions and triggers below).
create or replace function public.admin_note(p_action text, p_target text, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_log (admin_id, action, target, details)
  values (auth.uid(), p_action, coalesce(p_target, ''), coalesce(p_details, '{}'::jsonb));
$$;

revoke execute on function public.admin_note(text, text, jsonb) from public, anon, authenticated;

-- Stops anyone but an admin.
create or replace function public.admin_only()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can do that.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.admin_only() from public, anon, authenticated;

-- Regions: only admins add, change or remove them (everyone can still read them and choose one).
drop policy if exists "Signed-in users can add regions" on public.regions;
drop policy if exists "Users can update regions they added" on public.regions;
drop policy if exists "Users can delete regions they added" on public.regions;
drop policy if exists "Admins can add regions" on public.regions;
drop policy if exists "Admins can update regions" on public.regions;
drop policy if exists "Admins can delete regions" on public.regions;
create policy "Admins can add regions"
  on public.regions for insert to authenticated with check (public.is_admin());
create policy "Admins can update regions"
  on public.regions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete regions"
  on public.regions for delete to authenticated using (public.is_admin());

-- A region added, changed or removed by an admin goes in the log. A removed region's people are
-- left with no region (their profile by its foreign key; their account here), and asked to
-- choose one again. The nightly sync's own updates (sync times, errors) aren't logged.
create or replace function public.regions_admin_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  people int;
begin
  if auth.uid() is null then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform public.admin_note('region_added', new.name,
      jsonb_build_object('sheet_id', new.sheet_id, 'language', new.language));
  elsif tg_op = 'UPDATE' then
    perform public.admin_note('region_changed', new.name,
      jsonb_build_object('name', old.name, 'sheet_id', new.sheet_id,
        'language', new.language));
  else
    update auth.users
      set raw_user_meta_data = raw_user_meta_data - 'region_id'
      where raw_user_meta_data ->> 'region_id' = old.id::text;
    get diagnostics people = row_count;
    perform public.admin_note('region_removed', old.name,
      jsonb_build_object('people', people));
  end if;
  return null;
end;
$$;

drop trigger if exists regions_admin_log on public.regions;
create trigger regions_admin_log
  after insert or update of name, sheet_id, language, config or delete on public.regions
  for each row execute function public.regions_admin_log();

-- Everyone on Rocket, for the Admin page: name, email, region and whether they're an admin,
-- matching a search on name or email (all of them, up to 200, when it's blank).
create or replace function public.admin_people(p_query text default '')
returns table (
  id uuid,
  name text,
  email text,
  region_id uuid,
  region_scope text,
  region_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_admin boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_only();
  return query
    select p.id, p.name, u.email::text, p.region_id, p.region_scope::text, r.name,
      u.created_at, u.last_sign_in_at,
      exists (select 1 from public.admins a where a.user_id = p.id)
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.regions r on r.id = p.region_id
    where coalesce(btrim(p_query), '') = ''
      or p.name ilike '%' || btrim(p_query) || '%'
      or u.email ilike '%' || btrim(p_query) || '%'
    order by lower(p.name)
    limit 200;
end;
$$;

revoke execute on function public.admin_people(text) from public, anon;
grant execute on function public.admin_people(text) to authenticated;

-- Changes someone's name: on their profile (what others see; still one name per region) and their
-- account (what the app reads, F3 name included).
create or replace function public.admin_set_name(p_user uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  was text;
  wanted text := btrim(coalesce(p_name, ''));
begin
  perform public.admin_only();
  if wanted = '' then
    raise exception 'Give a name.';
  end if;
  select name into was from public.profiles where id = p_user;
  if not found then
    raise exception 'No such person.';
  end if;
  update public.profiles set name = wanted where id = p_user;
  update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('name', wanted, 'f3_name', wanted)
    where id = p_user;
  perform public.admin_note('name_changed', wanted, jsonb_build_object('from', was, 'user', p_user));
end;
$$;

revoke execute on function public.admin_set_name(uuid, text) from public, anon;
grant execute on function public.admin_set_name(uuid, text) to authenticated;

-- Changes someone's region: one region (by its ID), every F3 or FiA region ('all:f3', 'all:fia'),
-- or none (null). Their wording follows the region's organization, as when they choose it.
create or replace function public.admin_set_region(p_user uuid, p_region text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  region public.regions;
  scope text;
  label text;
begin
  perform public.admin_only();
  if p_region in ('all:f3', 'all:fia') then
    scope := substr(p_region, 5);
    update public.profiles set region_id = null, region_scope = scope where id = p_user;
    update auth.users
      set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('region_id', p_region, 'language', scope)
      where id = p_user;
    label := case scope when 'f3' then 'All F3 regions' else 'All FiA regions' end;
  elsif p_region is null or p_region = '' then
    update public.profiles set region_id = null, region_scope = null where id = p_user;
    update auth.users
      set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'region_id'
      where id = p_user;
    label := 'No region';
  else
    select * into region from public.regions where id = p_region::uuid;
    if not found then
      raise exception 'No such region.';
    end if;
    update public.profiles set region_id = region.id, region_scope = null where id = p_user;
    update auth.users
      set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('region_id', region.id::text, 'language', region.language)
      where id = p_user;
    label := region.name;
  end if;
  perform public.admin_note('region_set', (select name from public.profiles where id = p_user),
    jsonb_build_object('region', label, 'user', p_user));
end;
$$;

revoke execute on function public.admin_set_region(uuid, text) from public, anon;
grant execute on function public.admin_set_region(uuid, text) to authenticated;

-- Makes someone an admin, or not. No one removes themselves, and the last admin stays.
create or replace function public.admin_set_admin(p_user uuid, p_admin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_only();
  if p_admin then
    insert into public.admins (user_id, added_by) values (p_user, auth.uid())
      on conflict (user_id) do nothing;
  else
    if p_user = auth.uid() then
      raise exception 'You can''t remove yourself as an admin; another admin can.';
    end if;
    if (select count(*) from public.admins) <= 1 then
      raise exception 'Rocket needs at least one admin.';
    end if;
    delete from public.admins where user_id = p_user;
  end if;
  perform public.admin_note(case when p_admin then 'admin_added' else 'admin_removed' end,
    (select name from public.profiles where id = p_user), jsonb_build_object('user', p_user));
end;
$$;

revoke execute on function public.admin_set_admin(uuid, boolean) from public, anon;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
