-- Public profile for each auth user, so PAX can see who wrote what.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Signed-in users can read profiles"
  on public.profiles for select to authenticated using (true);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Create a profile automatically when someone signs up, using the name given at sign-up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backblasts are shared: every signed-in user can read them, only the author can change them.
create table public.backblasts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null,
  date date not null,
  ao text not null,
  q text not null,
  pax text[] not null default '{}',
  fngs text[] not null default '{}',
  warmup text,
  thang text,
  moleskin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index backblasts_date_idx on public.backblasts (date desc);
create index backblasts_author_idx on public.backblasts (author_id);

alter table public.backblasts enable row level security;

create policy "Signed-in users can read backblasts"
  on public.backblasts for select to authenticated using (true);

create policy "Users can create their own backblasts"
  on public.backblasts for insert to authenticated
  with check ((select auth.uid()) = author_id);

create policy "Authors can update their backblasts"
  on public.backblasts for update to authenticated
  using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);

create policy "Authors can delete their backblasts"
  on public.backblasts for delete to authenticated
  using ((select auth.uid()) = author_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger backblasts_set_updated_at
  before update on public.backblasts
  for each row execute function public.set_updated_at();
