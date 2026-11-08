-- F3 Delta: F3 wording and colors, reading its own Google Sheet.
insert into public.regions (name, sheet_id, language, config, created_by)
select
  'F3 Delta',
  '1oZq5tsxR7xV_tBdUF0DfgkjKgEH2dYd1dwk0m8XMA1Y',
  'f3',
  '{
    "sites": {
      "sheet": "Sites", "ao": "Name", "address": "Address", "location": "Location",
      "day": "Day", "time": "Time", "retired": ""
    },
    "roster": { "sheet": "Roster", "name": "F3 Name" },
    "attendance": {
      "sheet": "Master Data", "date": "PostDate", "ao": "AO.Name", "pax": "PAX.Name",
      "post": "Post", "q": "Q"
    }
  }'::jsonb,
  null
where not exists (select 1 from public.regions where name = 'F3 Delta');
