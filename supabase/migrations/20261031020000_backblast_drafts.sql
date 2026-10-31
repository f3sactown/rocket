-- Drafts: a backblast is saved as a draft while it's being written and published when it's done.
-- Drafts are visible only to their author and may be incomplete; published backblasts need the basics.
alter table public.backblasts
  add column status text not null default 'published' check (status in ('draft', 'published')),
  alter column title set default '',
  alter column ao set default '',
  alter column q set default '',
  alter column date drop not null,
  add constraint backblasts_published_complete check (
    status = 'draft'
    or (date is not null and title <> '' and ao <> '' and q <> '')
  );

create index backblasts_author_status_idx on public.backblasts (author_id, status);

drop policy "Signed-in users can read backblasts" on public.backblasts;

create policy "Read published backblasts and your own drafts"
  on public.backblasts for select to authenticated
  using (status = 'published' or (select auth.uid()) = author_id);
