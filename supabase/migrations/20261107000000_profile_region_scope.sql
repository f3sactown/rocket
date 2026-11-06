-- For PAX who choose "All F3 regions" or "All FiA regions": which organization's regions they post
-- across. Their profile has no single region then, so this tells others' screens to show, for each
-- of their workouts, the region its AO belongs to. Null for everyone else.
alter table public.profiles
  add column if not exists region_scope text check (region_scope in ('f3', 'fia'));
