-- Reusing your own workout doesn't add to its reuse count, just as you can't like your own: only
-- other Qs' reuses count. Everything else about workout_stats is unchanged.
create or replace function public.workout_stats(p_ids uuid[])
returns table (workout_id uuid, likes bigint, reuses bigint, liked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    w.id,
    (select count(*) from public.workout_likes l where l.workout_id = w.id),
    (
      select count(*) from public.workouts r
      where r.reused_from = w.id and r.author_id <> w.author_id
    ),
    exists (
      select 1 from public.workout_likes l
      where l.workout_id = w.id and l.user_id = (select auth.uid())
    )
  from public.workouts w
  where w.id = any (p_ids)
    and (
      (w.status = 'published' and w.visibility = 'public')
      or w.author_id = (select auth.uid())
    );
$$;

revoke execute on function public.workout_stats(uuid[]) from public, anon;
grant execute on function public.workout_stats(uuid[]) to authenticated;
