-- Credit for reused workouts: who wrote the workout a chain of Reuses started from. A reuse of a
-- reuse keeps pointing at the first author.
alter table public.workouts
  add column if not exists original_author_id uuid references public.profiles (id) on delete set null;

-- Fill it in for workouts already made with Reuse, following each chain back to its start.
with recursive chain as (
  select id, reused_from, author_id as origin_author
  from public.workouts
  where reused_from is null
  union all
  select w.id, w.reused_from, c.origin_author
  from public.workouts w
  join chain c on w.reused_from = c.id
)
update public.workouts w
set original_author_id = c.origin_author
from chain c
where w.id = c.id and w.reused_from is not null and w.original_author_id is null;
