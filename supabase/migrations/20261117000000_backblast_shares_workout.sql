-- A backblast linked to its Q's workout is the same workout: its title, basics (date, AO,
-- address, time) and workout sections (introduction, warm-up, the Thang with its thangs, words of
-- wisdom) are one, kept the same in both: a change to either is made to the other. Its own
-- parts (who posted, notes, announcements, Coffeeteria) are its own.
--
-- `rocket.syncing` (set for the transaction) marks the updates these triggers make to each other,
-- so they don't go round again.

-- A backblast keeps the Thang's thangs (timers and music) too, so editing it there loses nothing.
alter table public.backblasts
  add column if not exists thangs jsonb not null default '[]'::jsonb;

-- A linked backblast no longer lets go of its workout when its AO or date is edited: they're
-- changed together. Unlinked ones still link up on their own by AO and date, as before.
create or replace function public.backblast_follow_workout()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  found uuid;
  matches int;
begin
  if coalesce(current_setting('rocket.syncing', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and old.workout_id is not null
    and new.workout_id is not distinct from old.workout_id then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and new.ao is not distinct from old.ao
    and new.date is not distinct from old.date then
    return new;
  end if;
  if new.date is null or btrim(coalesce(new.ao, '')) = '' then
    return new;
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

-- A workout's linked backblast follows its AO and date (see workout_share_backblasts) rather
-- than being let go. A finished workout with none still links the Q's one unlinked backblast at
-- its AO and date.
create or replace function public.workout_follow_backblasts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  found uuid;
  matches int;
begin
  if coalesce(current_setting('rocket.syncing', true), '') = 'on' then
    return null;
  end if;
  if new.ao is not distinct from old.ao
    and new.date is not distinct from old.date
    and new.status is not distinct from old.status then
    return null;
  end if;
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

-- A backblast's shared parts, written to its workout. Thangs only when the backblast has them;
-- a Thang changed as text alone (no thangs) becomes that text on the workout too.
create or replace function public.backblast_to_workout(b public.backblasts)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('rocket.syncing', 'on', true);
  update public.workouts w
  set title = b.title,
      date = b.date,
      ao = b.ao,
      address = b.address,
      time = b.time,
      introduction = b.introduction,
      warmup = b.warmup,
      thang = b.thang,
      thangs = case
        when b.thangs <> '[]'::jsonb then b.thangs
        when b.thang is distinct from w.thang then '[]'::jsonb
        else w.thangs
      end,
      words_of_wisdom = b.words_of_wisdom
  where w.id = b.workout_id
    and w.author_id = b.author_id;
  perform set_config('rocket.syncing', 'off', true);
end;
$$;

-- Before a backblast is saved: just linked, it fills what it hasn't got from its workout and
-- gives the workout what it has; already linked, its shared parts go to the workout when changed.
create or replace function public.backblast_share_workout()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  w public.workouts;
  blank_thangs boolean;
begin
  if coalesce(current_setting('rocket.syncing', true), '') = 'on'
    or new.workout_id is null then
    return new;
  end if;
  select * into w from public.workouts where id = new.workout_id;
  if not found or w.author_id <> new.author_id then
    return new;
  end if;

  if tg_op = 'INSERT' or new.workout_id is distinct from old.workout_id then
    blank_thangs := new.thangs = '[]'::jsonb
      and (new.thang is null or new.thang is not distinct from w.thang);
    new.title := coalesce(nullif(btrim(new.title), ''), w.title);
    new.date := coalesce(new.date, w.date);
    new.ao := coalesce(nullif(btrim(new.ao), ''), w.ao);
    new.address := coalesce(nullif(btrim(coalesce(new.address, '')), ''), w.address);
    new.time := coalesce(nullif(btrim(coalesce(new.time, '')), ''), w.time);
    new.introduction := coalesce(
      nullif(btrim(coalesce(new.introduction, '')), ''), w.introduction);
    new.warmup := coalesce(nullif(btrim(coalesce(new.warmup, '')), ''), w.warmup);
    new.thang := coalesce(nullif(btrim(coalesce(new.thang, '')), ''), w.thang);
    if blank_thangs then
      new.thangs := w.thangs;
    end if;
    new.words_of_wisdom := coalesce(
      nullif(btrim(coalesce(new.words_of_wisdom, '')), ''), w.words_of_wisdom);
    perform public.backblast_to_workout(new);
    return new;
  end if;

  if (new.title, new.date, new.ao, new.address, new.time, new.introduction, new.warmup,
      new.thang, new.thangs, new.words_of_wisdom)
    is distinct from
     (old.title, old.date, old.ao, old.address, old.time, old.introduction, old.warmup,
      old.thang, old.thangs, old.words_of_wisdom) then
    perform public.backblast_to_workout(new);
  end if;
  return new;
end;
$$;

-- Runs after backblasts_follow_workout (triggers fire in name order), so a link it makes is shared.
drop trigger if exists backblasts_share_workout on public.backblasts;
create trigger backblasts_share_workout
  before insert or update on public.backblasts
  for each row execute function public.backblast_share_workout();

-- After a workout's shared parts change: the same change to its linked backblast.
create or replace function public.workout_share_backblasts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('rocket.syncing', true), '') = 'on' then
    return null;
  end if;
  if (new.title, new.date, new.ao, new.address, new.time, new.introduction, new.warmup,
      new.thang, new.thangs, new.words_of_wisdom)
    is not distinct from
     (old.title, old.date, old.ao, old.address, old.time, old.introduction, old.warmup,
      old.thang, old.thangs, old.words_of_wisdom) then
    return null;
  end if;
  perform set_config('rocket.syncing', 'on', true);
  update public.backblasts b
  set title = new.title,
      date = new.date,
      ao = new.ao,
      address = new.address,
      time = new.time,
      introduction = new.introduction,
      warmup = new.warmup,
      thang = new.thang,
      thangs = new.thangs,
      words_of_wisdom = new.words_of_wisdom
  where b.workout_id = new.id
    and b.author_id = new.author_id;
  perform set_config('rocket.syncing', 'off', true);
  return null;
end;
$$;

drop trigger if exists workouts_share_backblasts on public.workouts;
create trigger workouts_share_backblasts
  after update on public.workouts
  for each row execute function public.workout_share_backblasts();

-- Links already made are brought in line now: whichever of the two was changed last wins.
do $$
begin
  perform set_config('rocket.syncing', 'on', true);
  update public.workouts w
  set title = b.title, date = b.date, ao = b.ao, address = b.address, time = b.time,
      introduction = b.introduction, warmup = b.warmup, thang = b.thang,
      thangs = case when b.thang is distinct from w.thang then '[]'::jsonb else w.thangs end,
      words_of_wisdom = b.words_of_wisdom
  from public.backblasts b
  where b.workout_id = w.id
    and b.author_id = w.author_id
    and b.updated_at > w.updated_at;
  update public.backblasts b
  set title = w.title, date = w.date, ao = w.ao, address = w.address, time = w.time,
      introduction = w.introduction, warmup = w.warmup, thang = w.thang,
      thangs = w.thangs, words_of_wisdom = w.words_of_wisdom
  from public.workouts w
  where b.workout_id = w.id
    and b.author_id = w.author_id;
  perform set_config('rocket.syncing', 'off', true);
end;
$$;
