-- One Rocket account per name in a region: there's one Casper of F3 SacTown (another region can
-- have its own Casper). Names are compared trimmed and ignoring case. Accounts with no region
-- (or "all F3/FiA regions") aren't held to it.

-- Stops, naming them, if a region already has a name on more than one account: rename all but
-- one (or move them to their own region) and run this again.
do $$
declare
  dupes text;
begin
  select string_agg(format('"%s" in %s (%s accounts)', d.name, d.region, d.accounts), '; ')
    into dupes
  from (
    select lower(btrim(p.name)) as name, coalesce(r.name, p.region_id::text) as region,
      count(*) as accounts
    from public.profiles p
    left join public.regions r on r.id = p.region_id
    where p.region_id is not null
    group by 1, 2
    having count(*) > 1
  ) d;
  if dupes is not null then
    raise exception 'These names are on more than one account in the same region: %. Rename all but one first.', dupes;
  end if;
end;
$$;

create unique index if not exists profiles_name_per_region
  on public.profiles (region_id, lower(btrim(name)))
  where region_id is not null;

-- Whether a name is already someone else's in a region, for sign-up (before there's an account,
-- so anyone may ask) and Settings. Says only yes or no, never whose.
create or replace function public.name_taken(p_region uuid, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.region_id = p_region
      and lower(btrim(p.name)) = lower(btrim(p_name))
      and p.id is distinct from auth.uid()
  );
$$;

revoke execute on function public.name_taken(uuid, text) from public;
grant execute on function public.name_taken(uuid, text) to anon, authenticated;

-- A new account whose name is already taken in the region it chose (two signing up at once) is
-- still made, without the region, rather than failing the sign-up; Rocket then asks for the
-- region, and the name, again.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  chosen text := new.raw_user_meta_data ->> 'region_id';
  wanted text := coalesce(
    nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1));
  region uuid;
begin
  select r.id into region from public.regions r
    where chosen ~ '^[0-9a-fA-F-]{36}$' and r.id = chosen::uuid;
  if region is not null and exists (
    select 1 from public.profiles p
    where p.region_id = region and lower(btrim(p.name)) = lower(btrim(wanted))
  ) then
    region := null;
  end if;
  insert into public.profiles (id, name, region_id) values (new.id, wanted, region);
  return new;
end;
$$;
