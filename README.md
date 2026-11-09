# 🚀 Rocket

A suite of tools for F3 (and FiA) PAX at [rocket.f3sactown.com](https://rocket.f3sactown.com).
Rocket helps a Q plan a **workout**, run it, and then write and share the **backblast**.

## What it does

- **What's new:** after each update, Home shows a one-time note with the version, the build
  number and the changes in that build (its `feat:`, `fix:` and `perf:` commits; only the latest
  build, the first four with Show more). Dismissing it is saved to the account, so it stays gone on
  every device until the next build; new accounts start on the current build.
- **Home:** your total posts and Qs from your region's sheet (with the date the sheet was last
  updated), **Today's workouts** (your finished workouts dated today, by start time; tap one to
  run it; each drops off an hour after its end time, and the section hides when none are left), your drafts, **Future workouts** (your finished workouts dated after today, soonest
  first; Recent workouts then keeps to today and earlier), trending workouts, and your most recent
  workouts and backblasts. Which of
  these show is chosen in Settings → Home screen (all but trending, to start).
- **Workouts** are written first: Basics (title, AO, date, time), Introduction, Warm-o-rama,
  The Thang, Notes and Words of Wisdom (CoT in FiA wording). The Workouts page lists only your own;
  others' public workouts are on Discover. Your finished workouts dated today or earlier show a
  **Needs backblast** badge (in lists and on Home, but never on Discover) until a backblast from them is
  finished; others' workouts never do.
  - The Thang can hold several thangs. Each can have a **timer** (Countdown, Stopwatch, AMRAP,
    Tabata (work and rest for a number of rounds; 20 seconds on, 10 off, 8 rounds to start) or EMOM) and **music** (a link to a song or playlist, shown in the output as 🎵 Title 🎵
    with the link on the next line).
  - A workout's **Notes** are private to its Q: stored in their own table only the author can read,
    and left out of anything copied or shared.
  - **Run workout** shows the whole workout to lead from (web addresses are clickable links), in Normal, Large or Extra large text, with
    each timer's countdown. Like a Tabata timer, every stretch (each round's work and rest) ends with
    short beeps at 3, 2 and 1 seconds left and a long, louder beep at 0. The timer in use pins to the top
    when scrolled away, and the screen stays awake.
  - **Reuse** starts a new workout from an existing one, leaving the AO, location, date and time to
    choose again. Each workout shows how many times it's been reused by other Qs (counting archived copies; reusing your own doesn't count, just as you can't like your own).
    A reused workout credits the Q who wrote the first one (`workouts.original_author_id`), even
    when it's a reuse of a reuse: its page shows "Originally by" them and their region.
  - A finished workout is **public** by default (Settings → Sharing can make new ones start
    private): anyone signed in can see, like and reuse it. Its Q
    can make it **private** on its page: it disappears for everyone else (Discover, Trending, lists
    and search) but keeps its likes and reuse count, which only its Q sees until it's public again. **Likes:** one per person, on other people's public
    workouts.
- **Discover** shows public workouts from every other Q. At the top, a **From** picker chooses
  F3's, FiA's or both (the default), going by each author's region (authors with no region always
  show), and **Include my workouts** (off by default) adds yours; both are saved to your account.
  With yours included, a **My workouts** section ranks them by likes, then reuses. The
  groups are Trending (likes and reuses on the
  last 30 days' workouts, newer ones weighted up), Most liked, Most reused, At your region's AOs and
  Newest, each a row of tiles that scrolls sideways, naming each author and their region, with
  like buttons. Trending on Home follows the From choice and leaves out your own workouts, and
  scrolls sideways the same way. The rows' scrollbars are thin and faint, with no arrows.
- **PAX** (in the menu, under Search) lists everyone on your region's roster (or every region's,
  when you've chosen all regions) as tiles in alphabetical order (three across on a phone, four on larger screens), with a search box that matches
  names. Each tile shows the PAX's regions, posts and Qs (from the synced region stats, or read
  straight from the sheet for a region added since the last sync) and the
  total likes and reuses on their public Rocket workouts, with the same heart and reuse icons as
  workout tiles. A **From** picker of regions, in each
  region's color, narrows the list and the totals; the choice is saved to your account. A tile
  opens the PAX's profile: posts, Qs, likes and reuses in one row on top, their stats per region and their Trending workouts, then **All workouts** and **All backblasts** (every public one, newest first;
  archived ones included, private ones left out).
  At the top, a **New on Rocket** note names whoever has signed up for a Rocket account since you
  last dismissed it (the last two weeks, the first time), with their region, each linking to their
  profile. Dismissing it is saved to the account; it comes back when someone new signs up.
  The regions show as mini tiles in each region's color with the posts and Qs there.
  A name with one of the same organization's regions in parentheses, like "Baby Shark (Dry
  Creek)" on F3 SacTown's roster, is the same PAX as "Baby Shark" of F3 DryCreek: one tile, with
  both regions' posts and Qs (spaces, case and the F3 or FiA prefix don't matter). Likewise
  "Atlas (DR)" (Down Range) is the same PAX as "Atlas". An F3 PAX is never merged with a FiA one.
  The same name in F3 and in FiA is two different PAX, each with their own tile, profile and
  numbers; likes, reuses and workouts come from the Rocket account of that name in the same
  organization (or one with no region, which can't be told apart).
- **Backblasts** are made from a finished workout with **Create backblast**, or from **New
  backblast**, which lists your finished workouts (archived ones too) that don't have a backblast yet to
  pick from, or starts one without a workout. Only a workout's Q writes its backblast, so other
  people's workouts have no Create backblast button. A finished backblast is **public** by default
  (Settings → Sharing can make new ones start private): anyone signed in can read it, and it shows on
  its Q's PAX profile. Its Q can switch it to **private** on its page. The backblast holds
  its own copy of the workout's sections, which can be edited without changing the workout
  (**Update from workout** copies it again). Its pages are Workout, Notes, Name-o-rama (Qs and
  PAX, with roster suggestions and the AO's regulars), Announcements (the backblast's own, not
  copied from the workout), Coffeeteria (CoFiA in FiA wording) and Review (to check it over; Copy
  and Share are on the finished backblast's page).
  - A backblast waits for its workout: until the workout's date, **Create backblast** is greyed
    out with the reason, and New backblast shows that workout greyed out with the date it opens.
  - **Copy** and **Share** produce Band- and Slack-ready text (Event Data, Workout Details, COT), ending with a
    plain comma-separated list of everyone who posted.
  - On a finished backblast's page, **Copy**, **Share** and copying the text on screen all give
    exactly the same text, including the link to its workout. Share sends only that text (no
    separate title), and Copy and Share wait the moment it takes to check the workout is public.
- **Library:** at the top right of a workout's Warm-o-rama, and with each thang on The Thang,
  **Library** opens the F3 and FiA Exicons together: search, choose the source (F3, FiA or both),
  Exercises / Routines and tags (tags that differ only in case, like "Warm-Up" and "Warm-up", are
  one tag; on a phone, two rows of tags that scroll sideways), read an entry, and add it by name or with its description. Each
  entry carries a badge: F3 in F3 red, FiA in FiA teal, and a region's own entries in that region's
  color. Each region gets a color in the order regions were added (blue, then pink, violet, amber, lime and on), so it's the same for every user.
  On the light theme the badges and source chips use deeper shades with white text.
  The **Library** page (in the menu, under Discover) browses the same entries on their own, with
  Copy and Copy with description in place of Add.
- **Templates:** each text section (all but Notes and the Name-o-rama) can be saved as a template,
  and one per section can be starred as the default that fills new workouts or backblasts. The
  Introduction also offers a built-in template: **F3 standard** (welcome, the three Fs, mission,
  five core principles, disclaimer and credo) in F3, or **FiA Disclaimer** in FiA.
- **From pickers** (Library, PAX, Discover): on a phone, one line of chips that scrolls sideways.
- **About** (last in the menu): what Rocket is and does, the running version and build, and the
  **Changelog**: every release from `CHANGELOG.md` (read when the site is built), newest first and
  open, the rest folded; commit links and repeated lines are left out.
- **Lists:** swipe to archive or delete (directions set in Settings), with Undo. Archiving hides a
  workout or backblast only from your own Workouts and Backblasts lists (and Home's Recent lists);
  everywhere else (Today's and Future workouts, New backblast, Discover, Trending, PAX profiles) it
  still shows unless it's private. **Archive** lists what you've archived; **Search** finds workouts and backblasts by any word, with matches
  highlighted.
- **Continue with Google:** sign in or sign up with a Google account instead of a password. The
  first time, a **Welcome** step asks for your F3 name and region (Google gives your real name and
  no region, and Rocket matches PAX to their roster by F3 name), then you're in. Signing in with
  Google using the same email as an existing account opens that account. The F3 name is also kept
  as `f3_name` in the account, since each Google sign-in overwrites `name` with the Google name.
  Setup: see "Google sign-in" below.
- **Forgot password:** Sign in → **Forgot password?** emails a reset link (Supabase's built-in
  mailer and standard template, no custom SMTP needed). The link opens `/reset-password` on any
  device, signed in for the reset, where you choose a new password. Supabase → Authentication →
  URL Configuration must have the site as the Site URL and under Redirect URLs.
- **Settings:** name, email, password, region, organization (F3 or FiA, which also sets the app's words; set by a shared region, so it's
  locked while you have one, and free to choose with no region or one you added), theme, accent color (F3 red, FiA teal, blue, green, orange or violet), the launch
  animation, what Home shows,
  swipe directions, and **Sharing**: whether new workouts and new backblasts start public or private,
  and whether a copied or shared backblast from a public workout ends with
  a link to that workout asking PAX to like and reuse it (right above the hidden PAX list; on by
  default, never shown on screen).
- **Copying:** the backblast and workout text on their pages and on the review step can't be
  selected, so it's copied with Copy or Share. If a copy takes it in anyway (Select All), it gets
  exactly what Copy gives, link and PAX list included. **Your data** exports everything you have
  (settings, including the Discover and PAX pickers, workouts with their notes, backblasts, saved templates, archive and likes) as a JSON
  file, and imports one back: it shows what's new and, for workouts, backblasts or templates you
  already have, lets you keep yours, replace them or keep both (settings are optional). **Reset
  account** (type RESET to confirm) deletes all of that and restores default settings; your login
  and name stay. Likes and reuses others gave a deleted workout (deleted on its own or by a reset)
  are set aside in the database and come back when that workout is imported again by its author;
  a "Keep both" copy starts fresh, since the original keeps them.

## Stack

- **Share link:** under a workout's or backblast's Copy and Share, the row of small actions is
  Share link, Archive and Delete. **Share link** shares the page's address through the device's
  share sheet, or copies it where sharing isn't available ("Link copied"). A draft or private one
  can't be opened by anyone else, so tapping it then says "Finish it to share a link" or "Make it
  public to share a link" instead.
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

The **Rocket Q Planner** wordmark (`apps/web/src/components/wordmark.tsx`) is the logo traced into
vector paths: "ROCKET" takes the current text color and "Q PLANNER" the accent. It's in the top bar
("ROCKET" only), on the launch screen and on the sign-in card.

## Who can see what

The app runs entirely in the browser, so access rules live in the database as row-level security
(`supabase/migrations`). They hold no matter which app or client talks to Supabase:

- Signed-out visitors can't read anything.
- Signed-in users can read every profile and every finished **public** workout and backblast
  (`visibility`, public by default). Private ones and drafts are visible only to their author.
- Likes (`workout_likes`): you can like someone else's public workout once, and see only your own
  likes; counts of likes and reuses come from `workout_stats()`, which returns totals only.
- Only the author can edit or delete a workout or backblast.
- When a workout is deleted, a trigger copies its likes and reuse links to `retired_workout_likes`
  and `retired_workout_reuses`, which no one can read. Only `restore_workout_links()`, called on
  import, moves them back, and only for the deleted workout's own author, so an edited export file
  can't add likes.
- A workout's notes (`workout_notes`) can be read and written only by the workout's author.
- Archiving is personal (`workout_archives`, `backblast_archives`): it hides an item from your own
  lists only, and never changes whether a workout or backblast is public.

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

## Google sign-in

**Continue with Google** uses Supabase Auth's Google provider; nothing in the app holds Google
keys. It needs a Google OAuth client, then the Google provider turned on in each Supabase project
(production and dev).

1. **Google Cloud project.** At [console.cloud.google.com](https://console.cloud.google.com),
   create a project (e.g. "Rocket") or pick an existing one.
2. **Consent screen.** Google Auth Platform → **Branding** (older consoles: APIs & Services →
   OAuth consent screen): app name **Rocket**, a support email, and the logo if you like. Under
   **Audience**, choose **External**. Under **Data access**, the default scopes are enough
   (`openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`); these aren't sensitive, so
   Google doesn't need to review the app. Under **Branding → Authorized domains**, add
   `supabase.co` and `f3sactown.com`.
3. **Publish it.** Under **Audience**, click **Publish app** so it's **In production**. Left in
   "Testing", only the test users you list can sign in.
4. **OAuth client.** Google Auth Platform → **Clients** → **Create client**, type **Web
   application**, name "Rocket". Add both projects' callback addresses under **Authorized redirect
   URIs**:
   - `https://glladkuyofbrewktcqly.supabase.co/auth/v1/callback` (production)
   - `https://funktsbvbcblniokpheu.supabase.co/auth/v1/callback` (dev)

   **Authorized JavaScript origins** can stay empty. Create it, and copy the **Client ID** and
   **Client secret**.

5. **Supabase, in each project** (rocket, then rocket-dev): Authentication → **Sign In /
   Providers** → **Google** → turn on **Enable Sign in with Google**, paste the client ID and
   secret, and **Save**. Leave "Skip nonce checks" off.
6. **Return addresses, in each project:** Authentication → **URL Configuration**. The **Site URL**
   is the site (`https://rocket.f3sactown.com/` for production, `https://rocket-dev.f3sactown.com/`
   for dev), and the same address is under **Redirect URLs** (it already is for email sign-up).
7. **Try it on dev first:** open rocket-dev.f3sactown.com, choose **Continue with Google**, pick
   an account, and you should land on the **Welcome** step, then Home.

The client secret stays in Supabase only; don't commit it or put it in a GitHub secret. One Google
client serves both projects, since each project's callback address is listed on it.

## Dev site

A second copy of the app at [rocket-dev.f3sactown.com](https://rocket-dev.f3sactown.com) runs
against its own Supabase project, with its own accounts and data, so changes can be tried without
touching production. Search engines are kept out (`robots.txt`).

- **Workflow:** pull requests go into `dev` first. Merging one deploys it here (with its
  migrations applied to the dev database) to try out; when it's ready, a `dev` → `main` pull
  request takes it to production, after its migrations are run there.
- **Deploying:** every push to the `dev` branch runs `.github/workflows/deploy-dev.yml`. It applies
  any new migrations to the dev database (`supabase db push`), builds the site with the dev
  settings and publishes it to the `main` branch of
  [f3sactown/rocket-dev](https://github.com/f3sactown/rocket-dev), whose GitHub Pages serves it.
  Each deploy replaces everything on that branch, so keep nothing else there.
  To put any other branch on dev, run **Deploy dev site** from the Actions tab and pick the branch.
  A migration applied this way stays in the dev database even if its branch is dropped.
- **Data:** the nightly region sync and the weekly Exicon sync each run a second job, `sync-dev`,
  that copies the same sheets into the dev project. That activity also keeps the free project from
  pausing.
- **Settings:** the `development` environment (Settings → Environments) holds the dev values under
  the same names as production's repository settings, and overrides them in the dev jobs. Every dev
  job checks that its Supabase settings name the dev project, so a missing one can't fall back to
  production. The dev jobs are skipped until `DEV_SUPABASE_PROJECT_REF` is set.

| Where                               | Name                        | Value                                                                   |
| ----------------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| Repository variable                 | `DEV_SUPABASE_PROJECT_REF`  | The dev project's ref (the ID in its Supabase URL)                      |
| `development` environment, variable | `SUPABASE_URL`              | The dev project's URL                                                   |
| `development` environment, variable | `SUPABASE_PUBLISHABLE_KEY`  | The dev project's publishable key                                       |
| `development` environment, secret   | `SUPABASE_SERVICE_ROLE_KEY` | The dev project's secret key, for the syncs                             |
| `development` environment, secret   | `SUPABASE_DB_URL`           | The dev database's **Session pooler** connection string, for migrations |
| `development` environment, secret   | `DEV_SITE_DEPLOY_KEY`       | The private half of f3sactown/rocket-dev's deploy key                   |

One-time setup:

1. **Supabase project:** create `rocket-dev` at [supabase.com](https://supabase.com) (the free plan
   allows two active projects). In Authentication → URL Configuration, set the **Site URL** to
   `https://rocket-dev.f3sactown.com/` and add the same address under **Redirect URLs**.
2. **Repository for the site:** create an empty public repository, `f3sactown/rocket-dev`.
3. **Deploy key:** run `ssh-keygen -t ed25519 -N "" -C rocket-dev-deploy -f rocket-dev-deploy`. Add
   `rocket-dev-deploy.pub` to rocket-dev under Settings → Deploy keys with **Allow write access**,
   and the private `rocket-dev-deploy` as the `DEV_SITE_DEPLOY_KEY` secret below, then delete both
   files.
4. **Settings:** in this repository, create the `development` environment and add the settings in
   the table, then the `DEV_SUPABASE_PROJECT_REF` repository variable. For `SUPABASE_DB_URL`, use
   Supabase → **Connect** → **Session pooler** (GitHub's runners can't reach the direct connection),
   with the database password filled in and percent-encoded.
5. **First deploy:** create the `dev` branch from `main` and push it. The first run applies every
   migration and fills rocket-dev's `main` branch. Then run **Sync region data** and
   **Sync Exicon library** from the Actions tab to fill the dev database.
6. **Pages and domain:** in rocket-dev, Settings → Pages, set **Source** to **Deploy from a
   branch**, `main`, `/ (root)`. Add a DNS `CNAME` record from `rocket-dev` to
   `f3sactown.github.io`, then turn on **Enforce HTTPS** once the certificate is ready.

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

PAX who post across several regions can choose **All F3 regions** or **All FiA regions** instead
(stored as `all:f3` / `all:fia` in the account, with no single region on the profile). Then every
region of that organization counts: AOs and PAX names come from all of them, regulars and total
posts and Qs are added up, Discover shows an "At … AOs" group for each region with matching
workouts, and the organization is locked to F3 or FiA. Their profile records the organization
(`profiles.region_scope`), so on everyone's workout cards their workouts show the region the
workout's AO belongs to (or just F3 or FiA for an AO typed in that's on no region's list).

- The sheet must be shared so **anyone with the link can view** it.
- Each region records which tabs and column headers hold its AOs, roster and attendance, and its
  organization: choosing a region switches the user to its wording and colors. **F3 SacTown** (F3)
  is set up by `supabase/migrations/20261101000000_regions.sql`, **FiA SacTown** (FiA) by
  `supabase/migrations/20261105020000_fia_sactown_region.sql`, **F3 Delta** (F3) by
  `supabase/migrations/20261107010000_f3_delta_region.sql` and **F3 DryCreek** (F3) by
  `supabase/migrations/20261108000000_f3_drycreek_region.sql` (its Sites tab has no address
  column, so the AO's Location is used). Others can be added in Settings,
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
- **FiA:** FiA's Exicon, the "Updated FiA Exicon"
  [Google Sheet](https://docs.google.com/spreadsheets/d/1twkcFAxUQHbKCQBnQSFxqMOKJ7kOXsDoQcJQsW37Efg/edit),
  which must stay shared so anyone with the link can view it. Its **FiA Nation Alphabetical** tab
  has no header row: each row is a name, a category and a description. **Term** rows (vocabulary)
  are left out; a "Routine" category makes a routine; each part of a category like
  "Arms/Shoulders" becomes a tag, using F3's names where they match (Abs is Core, Warm-up is
  Warm-Up, Full-body is Full Body). A trailing "*" on a name is dropped.
- **Region:** a region's own exercises and routines, from an optional **Exicon** tab in its Google
  Sheet (Name, Category, Tags, Description, Author), copied in by the nightly region sync
  (`replace_region_exicon()`). A Category of "Routine" makes a routine, any other category (but
  "Exercise") becomes a tag, Tags are split on commas, and the Author goes at the end of the
  description in parentheses. These entries carry a badge with the region's name. Every configured
  region gets a source chip of its own beside F3 and FiA (even before it has entries), and all
  sources start selected.

`.github/workflows/sync-exicon.yml` runs `scripts/sync-exicon.mjs` every Monday (about 2am Pacific,
or on demand from the Actions tab). Each source replaces its own rows in `exicon_entries`, so if one
fails (an error, or a nearly empty list) the other still updates and the failed one keeps last
week's copy; the run shows red with the reason. It uses the same `SUPABASE_URL` variable and
`SUPABASE_SERVICE_ROLE_KEY` secret as the region sync. Signed-in users can only read the library.
The Codex list isn't a documented API, so a change on their side could break the F3 half.

## Database changes

Each change to the database is a file in `supabase/migrations`. The dev site applies new ones to
the dev database when it deploys. On the production project, apply them with `pnpm db:push`, or
paste them into the Supabase SQL Editor in filename order. A pull request that adds one says so,
and should be merged only after the migration has run on production.

## Backups

`.github/workflows/backup-db.yml` backs up the production database every night (about 2am Pacific,
or on demand from the Actions tab). It runs `supabase db dump` three times (roles, schema, and data
including `auth.users`), encrypts the result with a passphrase and uploads it with
[rclone](https://rclone.org/drive/) to the **Apps › Rocket › Backup** folder in Google Drive as
`rocket-db-YYYY-MM-DD.tar.gz.gpg`. Backups older than 90 days are moved to Drive's trash. Nothing is
kept on GitHub, and the dump only leaves the runner encrypted.

It needs these repository **secrets**:

- `SUPABASE_DB_URL`: the production database's **Session pooler** connection string (Supabase →
  Connect), with the database password filled in.
- `BACKUP_PASSPHRASE`: a long random passphrase (at least 20 characters). Keep a copy somewhere
  safe outside GitHub, such as a password manager. Without it the backups can't be opened.
- `GDRIVE_TOKEN`: access to your Google Drive. On your computer, with
  [rclone installed](https://rclone.org/install/), run the command below, sign in with the Google
  account whose Drive should hold the backups, then run `rclone config show gdrive` and copy the
  JSON after `token =`:

  ```bash
  rclone config create gdrive drive scope=drive.file
  ```

This signs in through rclone's own Google app, which Google has verified, so there's no Google
Cloud setup. It shares Google's rate limits with other rclone users, which one small file a night
won't notice. To use an OAuth client of your own instead, create a **Desktop app** client in a
Google Cloud project with the Drive API enabled and its consent screen **published** (an app left
in "Testing" blocks sign-in for anyone who isn't a test user, and its tokens expire after 7 days).
Then add `client_id=… client_secret=…` to the command above and set the `GDRIVE_CLIENT_ID` and
`GDRIVE_CLIENT_SECRET` secrets to match. The token only works with the client that made it.

With `drive.file`, rclone can see only the files and folders it created, not the rest of your
Drive. The workflow creates **Apps**, **Rocket** and **Backup** itself on its first run; a folder
of the same name that you made by hand stays empty, and the workflow makes its own beside it.
Don't rename or move the folders Rocket created, or the next run starts new ones.

To restore one, download it from Drive, then:

```bash
gpg -d rocket-db-YYYY-MM-DD.tar.gz.gpg | tar -xz   # asks for the passphrase
psql "$TARGET_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
  -f roles.sql -f schema.sql -c 'SET session_replication_role = replica' -f data.sql
```

Restore into a new, empty Supabase project, or into the local stack, rather than over the live
database. Never commit a decrypted dump (`backup/` is git-ignored): it holds users' emails and
password hashes.

## Versions and releases

Rocket is in **alpha** (`0.1.0-alpha.N`); the running version and build number show in the footer.
Versions and the [changelog](CHANGELOG.md) are meant to be managed automatically from commit
messages (see [RELEASING.md](RELEASING.md)). Until GitHub Actions is allowed to open pull requests
(Settings → Actions → General), each release is bumped by hand.

## License

[GPL-3.0](LICENSE)
