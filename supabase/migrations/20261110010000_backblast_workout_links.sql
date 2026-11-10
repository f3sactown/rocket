-- A backblast and its Q's workout stay linked while they're at the same AO on the same date
-- (ignoring case and spaces), and link up on their own when exactly one pair matches. A link
-- chosen by hand stays until the AO or date is edited.

-- When a backblast's AO or date is set or changed (and both are filled in): let go of a workout
-- that no longer matches, then link to the Q's one finished workout that does and has no backblast.
create or replace function public.backblast_follow_workout()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  found uuid;
  matches int;
begin
  if tg_op = 'UPDATE'
    and new.ao is not distinct from old.ao
    and new.date is not distinct from old.date then
    return new;
  end if;
  -- Still being written: a backblast started from a workout keeps its link until it has both.
  if new.date is null or btrim(coalesce(new.ao, '')) = '' then
    return new;
  end if;
  if new.workout_id is not null and not exists (
    select 1 from public.workouts w
    where w.id = new.workout_id
      and w.date = new.date
      and lower(btrim(w.ao)) = lower(btrim(new.ao))
  ) then
    new.workout_id := null;
  end if;
  if new.workout_id is null then
    select min(w.id::text)::uuid, count(*)
      into found, matches
    from public.workouts w
    where w.author_id = new.author_id
      and w.status = 'published'
      and w.date = new.date
      and lower(btrim(w.ao)) = lower(btrim(new.ao))
      and not exists (
        select 1 from public.backblasts b
        where b.workout_id = w.id and b.id <> new.id
      );
    if matches = 1 then
      new.workout_id := found;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists backblasts_follow_workout on public.backblasts;
create trigger backblasts_follow_workout
  before insert or update on public.backblasts
  for each row execute function public.backblast_follow_workout();

-- When a workout's AO or date changes, or it's finished: let go of backblasts that no longer
-- match, then, if it has none, link the Q's one unlinked backblast at that AO and date.
create or replace function public.workout_follow_backblasts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  found uuid;
  matches int;
begin
  if new.ao is not distinct from old.ao
    and new.date is not distinct from old.date
    and new.status is not distinct from old.status then
    return null;
  end if;
  update public.backblasts b
  set workout_id = null
  where b.workout_id = new.id
    and b.date is not null
    and btrim(coalesce(b.ao, '')) <> ''
    and (
      new.date is null
      or b.date <> new.date
      or lower(btrim(b.ao)) <> lower(btrim(coalesce(new.ao, '')))
    );
  if new.status = 'published'
    and new.date is not null
    and btrim(coalesce(new.ao, '')) <> ''
    and not exists (select 1 from public.backblasts b where b.workout_id = new.id) then
    select min(b.id::text)::uuid, count(*)
      into found, matches
    from public.backblasts b
    where b.author_id = new.author_id
      and b.workout_id is null
      and b.date = new.date
      and lower(btrim(b.ao)) = lower(btrim(new.ao));
    if matches = 1 then
      update public.backblasts set workout_id = new.id where id = found;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists workouts_follow_backblasts on public.workouts;
create trigger workouts_follow_backblasts
  after update on public.workouts
  for each row execute function public.workout_follow_backblasts();
