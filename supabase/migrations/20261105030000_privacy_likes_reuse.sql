-- Replace every existing read rule on backblasts and workouts (whatever earlier versions were
-- named), so only the rules below decide who can read them.
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('backblasts', 'workouts') and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Backblasts are private: only their author can read them.
create policy "Authors can read their backblasts"
  on public.backblasts for select to authenticated
  using ((select auth.uid()) = author_id);

-- Finished workouts are public unless their author makes them private. Drafts are always private.
-- (Archiving is personal and never changes this.)
alter table public.workouts
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'private')),
  -- The workout this one was made from with Reuse, for counting reuses.
  add column if not exists reused_from uuid references public.workouts (id) on delete set null;

create index if not exists workouts_reused_from_idx on public.workouts (reused_from);

create policy "Read public workouts and your own"
  on public.workouts for select to authenticated
  using (
    (status = 'published' and visibility = 'public')
    or (select auth.uid()) = author_id
  );

-- Likes: one per person per workout, on someone else's public workout.
create table if not exists public.workout_likes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, workout_id)
);

create index if not exists workout_likes_workout_idx on public.workout_likes (workout_id);

alter table public.workout_likes enable row level security;

drop policy if exists "Users can see their own likes" on public.workout_likes;
create policy "Users can see their own likes"
  on public.workout_likes for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can like others' public workouts" on public.workout_likes;
create policy "Users can like others' public workouts"
  on public.workout_likes for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id
        and w.status = 'published'
        and w.visibility = 'public'
        and w.author_id <> (select auth.uid())
    )
  );

drop policy if exists "Users can take back their likes" on public.workout_likes;
create policy "Users can take back their likes"
  on public.workout_likes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Like and reuse counts for workouts the caller can see. Only totals come back, so private
-- workouts made by reusing a public one are counted without being revealed.
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
    (select count(*) from public.workouts r where r.reused_from = w.id),
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
