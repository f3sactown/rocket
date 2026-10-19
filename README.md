# F3 Q Planner

A trimmed-down take on [f3stoner/f3-app](https://github.com/f3stoner/f3-app) with only the parts a Q needs:

- **Plan Workout**: date, AO, title, Introduction, Warm-O-Rama, any number of Thangs, Mary / Finisher, Notes, Third F, Announcements. It autosaves drafts and can save or insert section templates. You can also copy from an earlier workout.
- **Exicon Library**: exercises and thangs from the F3 Nation Exicon and the FiA Lexicon/Exicon (refreshed weekly), with search plus emphasis, equipment and tag filters. Press **Library** on any section to drop an entry into your plan.
- **Run Workout**: large-text view to read from at the AO, with Normal, Large and XL sizes. It keeps the screen awake while it's open.
- **Backblast**: quick-tap attendance from your PAX roster, plus Q / co-Q, visiting PAX and FNGs. The opening line fills in automatically, and the workout details come from the plan. Your edits stay put while attendance updates. Then Share or Copy it to BAND, Slack or GroupMe.
- **My Templates**, **AOs**, **Settings**, **Import / Export**.

No server, no login, no database. Everything is saved in the browser on each device (localStorage). Use Import / Export to back up your data or move it to another device.

## Free hosting

It's a static site (plain HTML/CSS/JS, no build step), so any static host works.

### Option A: GitHub Pages (recommended, makes updating easy)
1. Create a free GitHub account and a new **public** repository, e.g. `f3-q-planner`.
2. Upload every file and folder in this directory (drag them into the "Add file → Upload files" page). Keep the `data/` folder structure.
3. Open the repo's **Settings → Pages**. Under "Build and deployment" pick **Deploy from a branch**, branch `main`, folder `/ (root)`, then Save.
4. After a minute the site is live at `https://<your-username>.github.io/f3-q-planner/`.

### Option B: Netlify Drop
Go to https://app.netlify.com/drop and drag this whole folder onto the page. You get a URL right away. A free account keeps the site permanent.

### Option C: Cloudflare Pages
Create a Pages project, choose "Upload assets", and upload this folder.

On a phone, open the URL and use **Add to Home Screen**. It then runs like an app and still works offline at the AO.

> You can also try it by double-clicking `index.html`. Data saved that way stays tied to that file in that browser, so use the hosted copy for real use. Export from one and import into the other if you want to move data across.

## Program content (built-in saved items that update with the app)

`data/program.js` holds the content that comes with the app: starter templates, AOs and sample workouts.

- Every item has a permanent `id` starting with `p-`. Never reuse or change an id.
- To push new or changed content, edit the file, **bump `"version"`** (e.g. `1.0.0` → `1.1.0`) and redeploy.
- The next time someone opens the app:
  - new items are added, and a banner on Home says what changed;
  - program items they haven't edited are refreshed to the new text;
  - items they **edited** are treated as theirs and are never overwritten;
  - items they **deleted** never come back.
- In **Settings → Program content**:
  - **Ignore new program content** stops all adds and changes from updates;
  - **Remove all program items** clears every unedited built-in item in one step;
  - **Restore removed items** brings back anything they deleted;
  - **Get x.y.z content now** pulls one specific update while ignoring is on.

Program items carry a **Program** badge in My Templates, AOs and the Planner, so users can pick out and delete the ones they don't want.

In the Exicon library, F3 Nation Exicon entries carry a red **F3** badge and FiA Lexicon/Exicon entries a light green **FiA** badge. Program warm-up, thang and Mary templates also appear there with the **Program** badge, along with any entries in an optional `library` array in `data/program.js` (`{ id, name, text, kind: "exercise" | "thang", emphasis, equipment, tags }`). Under **Settings → Exicon library sources**, each user picks which of these sources (F3, FiA, Program) the Library shows (all of them by default), both on the Exicon page and in the planner's Library picker. To add a source, add an entry to `LIBRARY_SOURCES` in `app.js`; it starts out turned on for everyone.

`templates[].section` must be one of: `intro`, `warmup`, `thang`, `mary`, `notes`, `cot`.
Workouts follow this shape: `{ id, title, date, aoId, status, intro, warmup, thangs: [{title, content}], mary, notes, thirdF, announcements }`.
AOs follow this shape: `{ id, name, location, address, schedule }`.

## Import / Export

Settings → Import / Export (also in the menu).

- **Export**: tick any of Settings, PAX roster, AOs, Saved templates, Saved workouts and Backblasts, then download a `.json` file. Unedited program items are left out unless you tick that option.
- **Import**: choose a file. The app lists what the file contains, and you tick what to bring in. Then pick **Merge** (adds new items and updates matching ones) or **Replace** (wipes the selected categories first).

## Regions

**Settings → Region** picks where the AOs, the PAX roster and recent attendance come from:

- **F3 SacTown**: AOs from `data/program.js`, the roster from `data/roster.js` and attendance from `data/attendance.js`. All three come from the F3 SacTown Data sheet and are refreshed weekly by GitHub Actions (see below). Choosing it also sets the region name to "F3 SacTown".
- **Custom Google Sheet**: the user enters a region name and pastes a Google Sheets link. The app reads the sheet straight from the browser through Google's `gviz/tq` CSV endpoint, which allows cross-origin reads, and re-reads it every 6 hours. The sheet must be shared as "Anyone with the link can view" and laid out like the SacTown sheet:
  - **Roster**: an "F3 Name" column;
  - **Master Data**: "Post Date", "AO Name" and "PAX Name", one row per PAX per workout. Only the last 180 days are requested;
  - **Sites**: "AO Name", "Day", "Location", "Time", "Address" and "Retired". Retired rows are skipped.

  Any tab can be missing. The parentheses rule below applies to these names too.
- **None** (the default for new installs): no region data. Installs from before regions existed are moved to F3 SacTown, since they already have its AOs and roster.

Until a region name is set, by picking a region or typing one, the home page shows a **Choose region** button that opens Settings → Region. After that, it shows **Set your nickname** until the F3 name is filled in.

Switching region removes the AOs and roster names the old region added. AOs the user edited are kept. To add another built-in region, add it to `REGIONS` in `app.js` along with its data files.

## PAX roster from the region sheet

`data/roster.js` holds the region's PAX names, taken from the **Roster** tab ("F3 Name" column) of the [F3 SacTown Data sheet](https://docs.google.com/spreadsheets/d/1_R4F0syR4m7eBen4j92PJCFeGrxEvNrbrL7LxFG46So/edit). Names with parentheses are left out (visitors from other regions such as "Spellcheck (Delta)", and placeholders such as "Mike (FNG)"), except ones whose only parenthesis is "(2.0)", like "Bo (2.0)". `tools/fetch_roster.py` downloads it (the sheet is shared as "anyone with the link can view"), and the weekly refresh below keeps it current.

When the app opens, it adds any of those names it hasn't added before to that device's PAX roster, so they show up for quick-tap attendance on backblasts. A name a user removes from their roster (Settings → PAX roster) isn't added back. `data/attendance.js` comes from the same sheet's **Master Data** tab (one row per PAX per workout). `tools/fetch_attendance.py` keeps, for each AO, the last date each PAX posted there in the past 180 days, using the same parentheses rule as the roster.

On the backblast page, once an AO is picked, the people who posted at that AO in the last 3 months (before the backblast's date) are listed first, most recent first. They come from the attendance records, matched by AO name, plus backblasts saved on that device. Everyone else on the roster is behind **Show all**. With no AO picked, or an AO with no records, the first 30 roster names show instead. The search box finds anyone.

## Updating the exercise library

`data/library.js` is built from two sources:

- **F3**: the F3 Codex Exicon (https://codex.f3nation.com/exicon). `tools/fetch_exicon.py` downloads the Exicon page, pulls out the entries embedded in it and saves them as `source/exicon-export.csv` (the same `ID,Name,Description,Aliases` CSV the site's Export button gives you).
- **FiA**: the [FiA Lexicon/Exicon Google Sheet](https://docs.google.com/spreadsheets/d/1-aBi3UGOwhGChtKEFdVjikbqfcCWP35mcoKqqxqKssI/edit?gid=1132183543), "Lexicon" tab. `tools/fetch_fia.py` downloads its CSV export (the sheet is shared as "anyone with the link can view") and saves it as `source/fia-lexicon.csv`. Rows with Category `TERM` are glossary terms and are left out; `Routine` rows become thangs.

`tools/build_library.py` then turns both CSVs into `data/library.js`.

**Automatic refresh:** the **Refresh Exicon library** GitHub Action (`.github/workflows/refresh-exicon.yml`) downloads both sources every Monday and commits the result only when one of them changed. To run it now, open the repo's **Actions** tab → **Refresh Exicon library** → **Run workflow**. If a source changes layout, or returns far fewer entries than before, that source is left as it was and the run is marked failed (the other source still updates); check the run's log.

To refresh by hand:

```
python3 tools/fetch_exicon.py            # or: --html saved-exicon-page.html
python3 tools/fetch_fia.py               # or: --csv downloaded-sheet.csv
python3 tools/build_library.py
```

`build_library.py` also accepts any Exicon CSV export: `python3 tools/build_library.py path/to/export.csv`. The emphasis, equipment and tag filters are guessed from keywords in each description, so expect a few misses.

## Files
| File | What it is |
|---|---|
| `index.html`, `styles.css`, `app.js` | The app |
| `data/library.js` | Exicon library (generated) |
| `data/program.js` | Built-in saved content (AOs, templates, sample workout), versioned |
| `sw.js`, `manifest.webmanifest`, `icon*` | Offline support and home-screen install |
| `tools/fetch_exicon.py`, `tools/fetch_fia.py`, `tools/build_library.py`, `source/` | Exicon and FiA download scripts, the library rebuild script, and the source CSVs |
| `data/roster.js`, `tools/fetch_roster.py` | Region PAX roster (generated) and its download script |
| `data/attendance.js`, `tools/fetch_attendance.py` | Recent attendance per AO (generated) and its download script |
| `.github/workflows/refresh-exicon.yml` | Weekly Exicon, FiA, roster and attendance refresh |
