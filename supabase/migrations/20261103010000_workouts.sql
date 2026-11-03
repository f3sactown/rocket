-- Workouts: the plan a Q writes first. A backblast is made from a completed workout, copying its
-- sections; the workout's notes stay with the workout.
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'published')),
  title text not null default '',
  date date,
  ao text not null default '',
  address text,
  time text,
  introduction text,
  warmup text,
  thang text,
  notes text,
  announcements text,
  words_of_wisdom text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workouts_completed_complete check (
    status = 'draft' or (date is not null and title <> '' and ao <> '')
  )
);

create index if not exists workouts_date_idx on public.workouts (date desc);
create index if not exists workouts_author_status_idx on public.workouts (author_id, status);

alter table public.workouts enable row level security;

create policy "Read completed workouts and your own drafts"
  on public.workouts for select to authenticated
  using (status = 'published' or (select auth.uid()) = author_id);

create policy "Users can create their own workouts"
  on public.workouts for insert to authenticated
  with check ((select auth.uid()) = author_id);

create policy "Authors can update their workouts"
  on public.workouts for update to authenticated
  using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);

create policy "Authors can delete their workouts"
  on public.workouts for delete to authenticated
  using ((select auth.uid()) = author_id);

create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

-- The workout a backblast was made from, if any.
alter table public.backblasts
  add column if not exists workout_id uuid references public.workouts (id) on delete set null;

create index if not exists backblasts_workout_idx on public.backblasts (workout_id);

-- Archiving a workout is personal, like archiving a backblast.
create table if not exists public.workout_archives (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  archived_at timestamptz not null default now(),
  primary key (user_id, workout_id)
);

alter table public.workout_archives enable row level security;

create policy "Users can see what they archived"
  on public.workout_archives for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can archive for themselves"
  on public.workout_archives for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can unarchive their own"
  on public.workout_archives for delete to authenticated
  using ((select auth.uid()) = user_id);
