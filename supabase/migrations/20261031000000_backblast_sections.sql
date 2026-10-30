-- Restructure backblasts around the standard sections, with typed attendance.
-- attendees: [{ "name": text, "kind": "pax" | "visitor" | "fng" | "2.0", "region"?: text, "invitedBy"?: text }]
alter table public.backblasts
  drop column pax,
  drop column fngs,
  drop column moleskin,
  add column introduction text,
  add column attendees jsonb not null default '[]' check (jsonb_typeof(attendees) = 'array'),
  add column announcements text,
  add column words_of_wisdom text,
  add column third_f text,
  add column second_f text;
