-- Archiving is personal: it hides a backblast from your own list, not from anyone else's.
create table if not exists public.backblast_archives (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  backblast_id uuid not null references public.backblasts (id) on delete cascade,
  archived_at timestamptz not null default now(),
  primary key (user_id, backblast_id)
);

alter table public.backblast_archives enable row level security;

create policy "Users can see what they archived"
  on public.backblast_archives for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can archive for themselves"
  on public.backblast_archives for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can unarchive their own"
  on public.backblast_archives for delete to authenticated
  using ((select auth.uid()) = user_id);
