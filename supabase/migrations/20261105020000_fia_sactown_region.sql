-- FiA SacTown: FiA wording and colors, reading its own Google Sheet.
insert into public.regions (name, sheet_id, language, config, created_by)
select
  'FiA SacTown',
  '1PuKNvGWbvgq1PE7RyECcGTsYcV-pv5Umz-a4g7SM_yQ',
  'fia',
  '{
    "sites": {
      "sheet": "Sites", "ao": "Name", "address": "Location", "location": "",
      "day": "Day", "time": "Time", "retired": ""
    },
    "roster": { "sheet": "Roster", "name": "Name" },
    "attendance": {
      "sheet": "Master Data", "date": "Date", "ao": "AO", "pax": "PAX Name",
      "post": "Post", "q": "Q"
    }
  }'::jsonb,
  null
where not exists (select 1 from public.regions where name = 'FiA SacTown');
