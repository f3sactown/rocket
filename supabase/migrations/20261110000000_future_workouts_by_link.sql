-- A finished public workout dated after today (Pacific time, where Rocket's regions are) stays out
-- of everyone else's lists (Discover, Trending, PAX profiles, likes) until its day. Its Q sees it
-- as always, and its link still opens it for anyone signed in, through shared_workout() below.

-- Replace every existing read rule on workouts (whatever it was named), so only this one decides.
do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'workouts' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.workouts', p.policyname);
  end loop;
end $$;

create policy "Read public workouts from their day, and your own"
  on public.workouts for select to authenticated
  using (
    (
      status = 'published'
      and visibility = 'public'
      and (date is null or date <= (now() at time zone 'America/Los_Angeles')::date)
    )
    or (select auth.uid()) = author_id
  );

-- One workout by its ID, for its link: a finished public workout whatever its date, or your own.
-- Knowing the ID (it's random) is having the link; nothing here lists workouts.
create or replace function public.shared_workout(p_id uuid)
returns setof public.workouts
language sql
stable
security definer
set search_path = ''
as $$
  select w.*
  from public.workouts w
  where w.id = p_id
    and (
      (w.status = 'published' and w.visibility = 'public')
      or w.author_id = (select auth.uid())
    );
$$;

revoke execute on function public.shared_workout(uuid) from public, anon;
grant execute on function public.shared_workout(uuid) to authenticated;
