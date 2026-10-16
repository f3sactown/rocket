# F3 Q Planner

A trimmed-down take on [f3stoner/f3-app](https://github.com/f3stoner/f3-app) with only the parts a Q needs:

- **Plan Workout**: date, AO, title, Introduction, Warm-O-Rama, any number of Thangs, Mary / Finisher, Notes, Third F, Announcements. It autosaves drafts and can save or insert section templates. You can also copy from an earlier workout.
- **Exicon Library**: ~1,000 exercises and thangs from the F3 Nation Exicon (refreshed weekly), with search plus emphasis, equipment and tag filters. Press **Library** on any section to drop an entry into your plan.
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

In the Exicon library, F3 Nation Exicon entries carry a red **F3** badge. Program warm-up, thang and Mary templates also appear there with the **Program** badge, along with any entries in an optional `library` array in `data/program.js` (`{ id, name, text, kind: "exercise" | "thang", emphasis, equipment, tags }`). Under **Settings → Exicon library sources**, each user picks which of these sources (F3, Program) the Library shows (all of them by default), both on the Exicon page and in the planner's Library picker. To add a source, add an entry to `LIBRARY_SOURCES` in `app.js`; it starts out turned on for everyone.

`templates[].section` must be one of: `intro`, `warmup`, `thang`, `mary`, `notes`, `cot`.
Workouts follow this shape: `{ id, title, date, aoId, status, intro, warmup, thangs: [{title, content}], mary, notes, thirdF, announcements }`.
AOs follow this shape: `{ id, name, location, address, schedule }`.

## Import / Export

Settings → Import / Export (also in the menu).

- **Export**: tick any of Settings, PAX roster, AOs, Saved templates, Saved workouts and Backblasts, then download a `.json` file. Unedited program items are left out unless you tick that option.
- **Import**: choose a file. The app lists what the file contains, and you tick what to bring in. Then pick **Merge** (adds new items and updates matching ones) or **Replace** (wipes the selected categories first).

## Updating the exercise library

`data/library.js` is built from the F3 Codex Exicon (https://codex.f3nation.com/exicon) in two steps:

1. `tools/fetch_exicon.py` downloads the Exicon page, pulls out the entries embedded in it and saves them as `source/exicon-export.csv` (the same `ID,Name,Description,Aliases` CSV the site's Export button gives you).
2. `tools/build_library.py` turns that CSV into `data/library.js`.

**Automatic refresh:** the **Refresh Exicon library** GitHub Action (`.github/workflows/refresh-exicon.yml`) runs both steps every Monday and commits the result only when the Exicon changed. To run it now, open the repo's **Actions** tab → **Refresh Exicon library** → **Run workflow**. If the Exicon page changes layout, or returns far fewer entries than before, the run fails and nothing is committed; check the run's log.

To refresh by hand:

```
python3 tools/fetch_exicon.py            # or: --html saved-exicon-page.html
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
| `tools/fetch_exicon.py`, `tools/build_library.py`, `source/` | Exicon download and library rebuild scripts, and the source CSV |
| `.github/workflows/refresh-exicon.yml` | Weekly Exicon refresh |
