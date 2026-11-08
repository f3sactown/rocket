-- Backblasts become public or private like workouts: a finished public backblast can be read by
-- anyone signed in (it shows on its Q's PAX profile); drafts and private ones only by their
-- author. Existing backblasts start public, the new default.
alter table public.backblasts
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'private'));

create index if not exists backblasts_author_public_idx
  on public.backblasts (author_id, date desc)
  where status = 'published' and visibility = 'public';

-- Replace every existing read rule on backblasts (whatever it was named), so only this one decides.
do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'backblasts' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.backblasts', p.policyname);
  end loop;
end $$;

create policy "Read public backblasts and your own"
  on public.backblasts for select to authenticated
  using (
    (status = 'published' and visibility = 'public')
    or (select auth.uid()) = author_id
  );
