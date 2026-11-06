-- Your own exercises and routines, added in the Library. Private: only you can see, add, change or
-- delete yours. They're part of your data (exported, imported, and cleared by a reset).
create table if not exists public.user_exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  tags text[] not null default '{}',
  is_routine boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_exercises_owner_idx on public.user_exercises (owner_id);

alter table public.user_exercises enable row level security;

create policy "Users can see their own exercises"
  on public.user_exercises for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can add their own exercises"
  on public.user_exercises for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Users can change their own exercises"
  on public.user_exercises for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own exercises"
  on public.user_exercises for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop trigger if exists user_exercises_set_updated_at on public.user_exercises;
create trigger user_exercises_set_updated_at
  before update on public.user_exercises
  for each row execute function public.set_updated_at();
