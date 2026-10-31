-- A user can mark one saved template per section as their default; it pre-fills new backblasts.
-- Only sections that are usually the same each time can have a default.
alter table public.section_templates
  add column is_default boolean not null default false,
  add constraint section_templates_default_sections check (
    not is_default or section in ('introduction', 'attendees', 'thirdF', 'secondF')
  );

create unique index section_templates_one_default
  on public.section_templates (owner_id, section)
  where is_default;
