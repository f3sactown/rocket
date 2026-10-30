-- Reusable text a user saves for a backblast section (e.g. their usual Introduction or Second F).
-- Templates are private to their owner. Saving with an existing name replaces that template.
create table public.section_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  section text not null check (
    section in (
      'introduction', 'warmup', 'thang', 'attendees',
      'announcements', 'wordsOfWisdom', 'thirdF', 'secondF'
    )
  ),
  name text not null check (length(trim(name)) > 0),
  -- Plain text, or a JSON attendee list for the 'attendees' (Name-o-rama) section.
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, section, name)
);

alter table public.section_templates enable row level security;

create policy "Users can read their own templates"
  on public.section_templates for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can create their own templates"
  on public.section_templates for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Users can update their own templates"
  on public.section_templates for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own templates"
  on public.section_templates for delete to authenticated
  using ((select auth.uid()) = owner_id);

create trigger section_templates_set_updated_at
  before update on public.section_templates
  for each row execute function public.set_updated_at();
