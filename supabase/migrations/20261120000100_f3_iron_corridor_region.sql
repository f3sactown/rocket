-- F3 Iron Corridor: F3 wording and colors, reading its own Google Sheet, laid out like F3
-- SacTown's (the default settings).
insert into public.regions (name, sheet_id, language, config, created_by)
select
  'F3 Iron Corridor',
  '1RJYyANVgYxIxCNtvyC19BBAtGevAId0C_3tbkynCkAw',
  'f3',
  '{
    "sites": {
      "sheet": "Sites", "ao": "AO Name", "address": "Address", "location": "Location",
      "day": "Day", "time": "Time", "retired": "Retired"
    },
    "roster": { "sheet": "Roster", "name": "F3 Name" },
    "attendance": {
      "sheet": "Master Data", "date": "Post Date", "ao": "AO Name", "pax": "PAX Name",
      "post": "Post", "q": "Q"
    }
  }'::jsonb,
  null
where not exists (select 1 from public.regions where name = 'F3 Iron Corridor');
