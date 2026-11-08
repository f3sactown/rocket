-- F3 DryCreek: F3 wording and colors, reading its own Google Sheet. Its Sites tab has no address
-- column, so each AO's Location stands in as where it meets.
insert into public.regions (name, sheet_id, language, config, created_by)
select
  'F3 DryCreek',
  '1wgRKUm2xsTFnfon_1sMXF78tb5cr93RPovFgUOiaqwY',
  'f3',
  '{
    "sites": {
      "sheet": "Sites", "ao": "Name", "address": "", "location": "Location",
      "day": "Day", "time": "Time", "retired": ""
    },
    "roster": { "sheet": "Roster", "name": "Name" },
    "attendance": {
      "sheet": "Master Data", "date": "Date", "ao": "AO", "pax": "PAX Name",
      "post": "Post", "q": "Q"
    }
  }'::jsonb,
  null
where not exists (select 1 from public.regions where name = 'F3 DryCreek');
