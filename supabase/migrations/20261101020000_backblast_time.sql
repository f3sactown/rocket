-- When the workout ran, e.g. "5:15am-6:00am", shown with the date in the Event Data part.
alter table public.backblasts add column if not exists time text;
