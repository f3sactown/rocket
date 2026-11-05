# 🚀 Rocket

A suite of tools for F3 (and FiA) PAX at [rocket.f3sactown.com](https://rocket.f3sactown.com).
Rocket helps a Q plan a **workout**, run it, and then write and share the **backblast**.

## What it does

- **Home:** your total posts and Qs from your region's sheet (with the date the sheet was last
  updated), your drafts, and the most recent workouts and backblasts.
- **Workouts** are written first: Basics (title, AO, date, time), Introduction, Warm-o-rama,
  The Thang, Notes, Announcements and Words of Wisdom.
  - The Thang can hold several thangs. Each can have a **timer** (Countdown, Stopwatch, AMRAP,
    Intervals or EMOM) and **music** (a link to a song or playlist, shown in the output as 🎵 Title 🎵
    with the link on the next line).
  - A workout's **Notes** are private to its Q: stored in their own table only the author can read,
    and left out of anything copied or shared.
  - **Run workout** shows the whole workout to lead from, in Normal, Large or Extra large text, with
    each timer's countdown (beeping through the last 10 seconds). The timer in use pins to the top
    when scrolled away, and the screen stays awake.
  - **Reuse** starts a new workout from an existing one, leaving the AO, location, date and time to
    choose again. Each workout shows how many times it's been reused (counting archived copies).
  - A finished workout is **public** by default: anyone signed in can see, like and reuse it. Its Q
    can make it **private** on its page. **Likes:** one per person, on other people's public
    workouts.
- **Discover** shows public workouts from every Q, grouped as Most liked, Most reused, At your
  region's AOs and Newest, with like buttons.
- **Backblasts** are made from a finished workout with **Create backblast**, or from **New
  backblast**, which lists the finished, unarchived workouts that don't have a backblast yet to pick
  from, or starts one without a workout. The backblast holds
  its own copy of the workout's sections, which can be edited without changing the workout
  (**Update from workout** copies it again). Its pages are Workout, Notes, Name-o-rama (Qs and
  PAX, with roster suggestions and the AO's regulars), Third F, Second F and Review.
  - A backblast can't be finished before its workout's date.
  - **Copy** and **Share** produce Slack-ready text (Event Data, Workout Details, COT), ending with a
    plain comma-separated list of everyone who posted.
- **Library:** at the top right of a workout's Warm-o-rama, and with each thang on The Thang,
  **Library** opens the F3 and FiA Exicons together: search, choose the source (F3, FiA or both),
  Exercises / Routines and tags, read an entry, and add it by name or with its description. Each
  entry carries an F3 or FiA badge in that organization's color.
- **Templates:** each text section (all but Notes and the Name-o-rama) can be saved as a template,
  and one per section can be starred as the default that fills new workouts or backblasts.
- **Lists:** swipe to archive or delete (directions set in Settings), with Undo. **Archive** lists
  what you've archived; **Search** finds workouts and backblasts by any word, with matches
  highlighted.
- **Settings:** name, email, password, region, F3 or FiA wording, theme, accent color, the launch
  animation, and swipe directions.

## Stack

- **[Next.js](https://nextjs.org) + TypeScript + Tailwind** for the web app
- **[Supabase](https://supabase.com)** for the Postgres database and login (Supabase Auth)
- **GitHub Pages** for hosting: the app is a static site that talks to Supabase from the browser
- **pnpm workspaces** monorepo so new tools can be added alongside the first

## Layout

```
apps/
  web/            Next.js app, exported as a static site
packages/
  core/           Shared F3 domain types and logic (backblast formatting, timers, thangs)
scripts/
  sync-regions.mjs  Nightly copy of each region's Google Sheet into Supabase
  sync-exicon.mjs   Weekly copy of the F3 and FiA Exicons into Supabase for the Library
supabase/
  config.toml     Local Supabase settings
  migrations/     SQL migrations: tables and row-level security policies
```

New tools go in `apps/` (or as routes inside `apps/web`); code shared between them goes in `packages/`.

## Who can see what

The app runs entirely in the browser, so access rules live in the database as row-level security
(`supabase/migrations`). They hold no matter which app or client talks to Supabase:

- Signed-out visitors can't read anything.
- Signed-in users can read every profile and every finished **public** workout. Private workouts,
  drafts and **all backblasts** are visible only to their author.
- Likes (`workout_likes`): you can like someone else's public workout once, and see only your own
  likes; counts of likes and reuses come from `workout_stats()`, which returns totals only.
- Only the author can edit or delete a workout or backblast.
- A workout's notes (`workout_notes`) can be read and written only by the workout's author.
- Archiving is personal (`workout_archives`, `backblast_archives`): it hides an item from your own
  lists only, and never changes whether a workout is public.

## Getting started

Requirements: Node 22+, pnpm 10+, and Docker (for the local Supabase stack).

```bash
pnpm install
pnpm db:start                   # starts local Supabase and applies migrations
cp .env.example apps/web/.env.local  # fill in the URL and publishable key printed by db:start
pnpm dev                        # http://localhost:3000
```

Local Supabase Studio runs at http://127.0.0.1:54323 and captured emails at http://127.0.0.1:54324.

## Deploying (GitHub Pages + Supabase)

Every push to `main` builds the static site and deploys it to GitHub Pages
(`https://<owner>.github.io/<repo>/`) via `.github/workflows/pages.yml`.

One-time setup:

1. **Supabase project:** create one at [supabase.com](https://supabase.com), then link it and apply
   the migrations:
   ```bash
   pnpm supabase link --project-ref <ref>
   pnpm db:push
   ```
2. **Repository variables:** in GitHub, go to Settings → Secrets and variables → Actions →
   **Variables** and add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (from Supabase → Project
   Settings → API). Both are safe to be public.
3. **Pages source:** in Settings → Pages, set **Source** to **GitHub Actions**.
4. **Supabase auth URLs:** in Supabase → Authentication → URL Configuration, set the **Site URL** to
   `https://<owner>.github.io/<repo>/` and add the same address under **Redirect URLs**.
5. Re-run the **Deploy to GitHub Pages** workflow (Actions tab), or push to `main`.

## Scripts

| Command                        | What it does                                        |
| ------------------------------ | --------------------------------------------------- |
| `pnpm dev`                     | Run the web app in development                      |
| `pnpm build`                   | Build everything                                    |
| `pnpm lint` / `pnpm typecheck` | Lint and type-check all packages                    |
| `pnpm test`                    | Run unit tests                                      |
| `pnpm format`                  | Format with Prettier                                |
| `pnpm db:start` / `db:stop`    | Start or stop the local Supabase stack              |
| `pnpm db:new <name>`           | Create a new migration file                         |
| `pnpm db:reset`                | Rebuild the local database from migrations          |
| `pnpm db:push`                 | Apply migrations to the linked hosted project       |
| `pnpm db:types`                | Regenerate TypeScript types from the local database |

## Moving off Supabase later

Everything is standard Postgres: `supabase db dump` (or `pg_dump`) exports the schema and data,
including users in `auth.users` with their hashed passwords. The app only talks to Supabase
through `apps/web/src/lib/supabase/` and `apps/web/src/components/auth-provider.tsx`, which keeps a
later switch contained.

## Secrets

The URL and publishable key are designed to be public; row-level security protects the data.
Never commit or expose the **secret / service-role key** — it bypasses row-level security.
`.env` files are git-ignored.

## Regions and Google Sheets

Each user picks a **region** (at sign-up or in Settings). A region points at a Google Sheet, and
Rocket uses it to list AOs by weekday (filling in their location, time and next date), suggest PAX
names, show the regulars at an AO over the last 3 months, show a user's total posts and Qs, and
show the newest post date in the attendance records.

- The sheet must be shared so **anyone with the link can view** it.
- Each region records which tabs and column headers hold its AOs, roster and attendance, and its
  organization: choosing a region switches the user to its wording and colors. **F3 SacTown** (F3)
  is set up by `supabase/migrations/20261101000000_regions.sql` and **FiA SacTown** (FiA) by
  `supabase/migrations/20261105020000_fia_sactown_region.sql`. Others can be added in Settings,
  with a **Check sheet** button that confirms every column exists.
- **Nightly sync:** `.github/workflows/sync-regions.yml` runs `scripts/sync-regions.mjs` every
  night (about 2–3am Pacific, or on demand from the Actions tab). It copies each region's active
  AOs, roster, regulars per AO (last 3 months), all-time totals per PAX and the newest post date
  into Supabase, and the app reads those. A region that hasn't synced yet is read from its sheet live. A failed sync keeps
  the previous copy and shows the error in Settings.
- The sync needs the repository **secret** `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project
  Settings → API Keys → secret key) alongside the `SUPABASE_URL` variable.
- Sheets are read with Google's Visualization API (`apps/web/src/lib/sheets.ts` in the app,
  `scripts/sync-regions.mjs` for the sync), so only the rows a query needs are downloaded.

## Exicon library

The Library is a weekly copy of two Exicons:

- **F3:** F3 Nation's Exicon from the [F3 Codex](https://codex.f3nation.com/exicon), read from the
  list its Exicon page loads (`https://codex.f3nation.com/api/exicon`). An entry tagged "Routine" is
  a routine; the rest are exercises. Descriptions are turned into plain text.
- **FiA:** FiA's Exicon, a
  [Google Sheet](https://docs.google.com/spreadsheets/d/1-aBi3UGOwhGChtKEFdVjikbqfcCWP35mcoKqqxqKssI/edit)
  that must stay shared so anyone with the link can view it. Its **Lexicon** tab (Name, Category,
  Description) gives exercises and routines; **TERM** rows (vocabulary) are left out, and the "Ab",
  "Warm up" and "Partner" categories become the Core, Warm-Up and Partner tags. Its **Lexirades 21**
  tab adds exercises tagged "Lexirades 21".

`.github/workflows/sync-exicon.yml` runs `scripts/sync-exicon.mjs` every Monday (about 2am Pacific,
or on demand from the Actions tab). Each source replaces its own rows in `exicon_entries`, so if one
fails (an error, or a nearly empty list) the other still updates and the failed one keeps last
week's copy; the run shows red with the reason. It uses the same `SUPABASE_URL` variable and
`SUPABASE_SERVICE_ROLE_KEY` secret as the region sync. Signed-in users can only read the library.
The Codex list isn't a documented API, so a change on their side could break the F3 half.

## Database changes

Each change to the database is a file in `supabase/migrations`. On the hosted project, apply new
ones with `pnpm db:push`, or paste them into the Supabase SQL Editor in filename order. A pull request
that adds one says so, and should be merged only after the migration has run.

## Versions and releases

Rocket is in **alpha** (`0.1.0-alpha.N`); the running version and build number show in the footer.
Versions and the [changelog](CHANGELOG.md) are meant to be managed automatically from commit
messages (see [RELEASING.md](RELEASING.md)). Until GitHub Actions is allowed to open pull requests
(Settings → Actions → General), each release is bumped by hand.

## License

[GPL-3.0](LICENSE)
