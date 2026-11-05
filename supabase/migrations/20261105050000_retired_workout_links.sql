-- Keeps the likes and reuses others gave a workout when it's deleted (by its Q, or by a reset), so
-- importing it again from an export brings them back. The file can't add any: they're kept here,
-- in the database, and only the workout's own author can bring them back.

-- Likes on a deleted workout. No foreign keys: rows are written while workouts (and, when an
-- account is deleted, profiles) are being removed. Restoring skips likers who are gone.
create table if not exists public.retired_workout_likes (
  workout_id uuid not null,
  author_id uuid not null,
  user_id uuid not null,
  liked_at timestamptz not null,
  primary key (workout_id, user_id)
);

-- Workouts that were made by reusing a deleted workout (their reused_from was cleared).
create table if not exists public.retired_workout_reuses (
  workout_id uuid not null,
  author_id uuid not null,
  reuse_id uuid not null,
  primary key (workout_id, reuse_id)
);

create index if not exists retired_workout_likes_author_idx
  on public.retired_workout_likes (author_id, workout_id);
create index if not exists retired_workout_reuses_author_idx
  on public.retired_workout_reuses (author_id, workout_id);

-- Nobody reads or writes these directly; only the functions below do.
alter table public.retired_workout_likes enable row level security;
alter table public.retired_workout_reuses enable row level security;

create or replace function public.retire_workout_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.retired_workout_likes (workout_id, author_id, user_id, liked_at)
  select old.id, old.author_id, l.user_id, l.created_at
  from public.workout_likes l
  where l.workout_id = old.id
  on conflict do nothing;

  insert into public.retired_workout_reuses (workout_id, author_id, reuse_id)
  select old.id, old.author_id, w.id
  from public.workouts w
  where w.reused_from = old.id and w.author_id <> old.author_id
  on conflict do nothing;

  return old;
end;
$$;

revoke execute on function public.retire_workout_links() from public, anon, authenticated;

drop trigger if exists workouts_retire_links on public.workouts;
create trigger workouts_retire_links
  before delete on public.workouts
  for each row execute function public.retire_workout_links();

-- Brings a deleted workout's likes and reuses back onto the caller's workout `p_new`, which was
-- imported from the export of workout `p_old`. Only the deleted workout's author can do this.
create or replace function public.restore_workout_links(p_old uuid, p_new uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.workouts where id = p_new and author_id = me
  ) then
    raise exception 'Not your workout';
  end if;

  insert into public.workout_likes (user_id, workout_id, created_at)
  select r.user_id, p_new, r.liked_at
  from public.retired_workout_likes r
  join public.profiles p on p.id = r.user_id
  where r.workout_id = p_old and r.author_id = me and r.user_id <> me
  on conflict do nothing;

  update public.workouts w
  set reused_from = p_new
  from public.retired_workout_reuses r
  where r.workout_id = p_old and r.author_id = me
    and w.id = r.reuse_id and w.reused_from is null;

  delete from public.retired_workout_likes where workout_id = p_old and author_id = me;
  delete from public.retired_workout_reuses where workout_id = p_old and author_id = me;
end;
$$;

revoke execute on function public.restore_workout_links(uuid, uuid) from public, anon;
grant execute on function public.restore_workout_links(uuid, uuid) to authenticated;
