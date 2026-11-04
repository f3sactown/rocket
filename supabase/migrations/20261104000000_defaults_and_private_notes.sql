-- Any section with saved templates can have a default, not just the ones that rarely change.
alter table public.section_templates
  drop constraint if exists section_templates_default_sections;

-- A workout's notes are for its Q alone, so they live in their own table that only the author can
-- read or write. (Finished workouts themselves are readable by everyone.)
create table if not exists public.workout_notes (
  workout_id uuid primary key references public.workouts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.workout_notes enable row level security;

create policy "Authors can read their workout notes"
  on public.workout_notes for select to authenticated
  using ((select auth.uid()) = author_id);

create policy "Authors can add notes to their own workouts"
  on public.workout_notes for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.author_id = (select auth.uid())
    )
  );

create policy "Authors can change their workout notes"
  on public.workout_notes for update to authenticated
  using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);

create policy "Authors can delete their workout notes"
  on public.workout_notes for delete to authenticated
  using ((select auth.uid()) = author_id);

create trigger workout_notes_set_updated_at
  before update on public.workout_notes
  for each row execute function public.set_updated_at();

-- Move any notes already written, then drop the readable column.
insert into public.workout_notes (workout_id, author_id, body)
select id, author_id, notes from public.workouts
where notes is not null and notes <> ''
on conflict (workout_id) do nothing;

alter table public.workouts drop column if exists notes;
