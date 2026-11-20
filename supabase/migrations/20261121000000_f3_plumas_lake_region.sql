-- F3 Plumas Lake: F3 wording and colors, reading its own Google Sheet. Its Sites tab names each AO
-- "Name" and marks retired ones in "Retire"; its Master Data names the AO "Site Name" and the
-- date "Date".
insert into public.regions (name, sheet_id, language, config, created_by)
select
  'F3 Plumas Lake',
  '1SV67kPW8jk_Ws4W_DPvGJ2_yiPvCncbAayhoCXwGYMs',
  'f3',
  '{
    "sites": {
      "sheet": "Sites", "ao": "Name", "address": "Address", "location": "Location",
      "day": "Day", "time": "Time", "retired": "Retire"
    },
    "roster": { "sheet": "Roster", "name": "F3 Name" },
    "attendance": {
      "sheet": "Master Data", "date": "Date", "ao": "Site Name", "pax": "PAX Name",
      "post": "Post", "q": "Q"
    }
  }'::jsonb,
  null
where not exists (select 1 from public.regions where name = 'F3 Plumas Lake');
