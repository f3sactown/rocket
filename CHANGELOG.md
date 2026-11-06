# Changelog

All notable changes to Rocket are recorded here. This file is maintained automatically by
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commit](https://www.conventionalcommits.org) messages; see [RELEASING.md](RELEASING.md).

## [0.1.0-alpha.4](https://github.com/f3sactown/rocket/compare/v0.1.0-alpha.3...v0.1.0-alpha.4) (2026-11-06)

### Features

* **Regions:** "All F3 regions" or "All FiA regions" for PAX who post across several: every such
  region's AOs and PAX in the form, totals added up, and an "At … AOs" group per region on
  Discover. Each region has its own Library color, the same for everyone.
* **Organization:** Settings chooses F3 or FiA (and with it the app's words), locked to your
  region's.
* **Home:** Today's workouts (tap to run), Future workouts, and Trending as a sideways row.
* **Discover:** sideways rows of tiles with each author's region, a My workouts section, and a
  one-time choice to include your own workouts.
* **Workouts:** the original author is credited on reuses; a Needs backblast badge on your past
  workouts without one; links on Run workout open; no Announcements section.
* **Backblasts:** only for your own workouts; Announcements is the backblast's own; Third F is
  gone and Second F is Coffeeteria (CoFiA for FiA); copying or sharing adds a link to the workout.
* **Library:** its own page, region Exicons, the new FiA Exicon sheet, alphabetical tags.
* **Your data:** export, import and reset in Settings.
* **Account:** forgot password; the Rocket Q Planner logo.

## [0.1.0-alpha.3](https://github.com/f3sactown/rocket/compare/v0.1.0-alpha.2...v0.1.0-alpha.3) (2026-11-05)

### Features

* **Privacy:** backblasts are private to their author; finished workouts are public by default
  and can be made private. Archiving never changes visibility.
* **Likes and reuses:** like other people's public workouts (once each), and see each workout's
  like and reuse counts.
* **Discover:** a page of public workouts grouped as Most liked, Most reused, At your region's AOs
  and Newest.
* **Library:** F3 and FiA Exicons, synced weekly, searchable by source, Exercises / Routines and
  tag, from the Warm-o-rama and each thang.
* **Regions:** FiA SacTown.
* **Backblasts:** New backblast asks which workout it's for; a backblast's copy of its workout can
  be edited; Reuse makes a copy and leaves where and when blank.
* **Workouts:** timers beep through the last 10 seconds; music links on their own line.


## [0.1.0-alpha.2](https://github.com/f3sactown/rocket/compare/v0.1.0-alpha.1...v0.1.0-alpha.2) (2026-11-04)

### Features

* **Home:** a new first page with your posts and Qs, the sheet's last update date, your drafts, and
  the most recent workouts and backblasts.
* **Run workout:** the whole workout in three text sizes, with timers (Countdown, Stopwatch,
  AMRAP, Intervals, EMOM) that beep through the last 10 seconds and pin to the top when scrolled
  away, music links, and the screen kept awake.
* **Thangs:** several per workout, each with an optional timer and music, separated by blank lines
  in the output with songs shown as 🎵 Title 🎵.
* **Workouts:** private Notes for the Q, Publish workout, Reuse to start a new workout from an
  existing one, and defaults for every section's templates.
* **Backblasts:** made from a workout with an editable copy of its sections, and can't be finished
  before the workout's date.
* **Settings:** turn the launch animation off; menu icons in the accent color.


## [0.1.0-alpha.1](https://github.com/f3sactown/rocket/compare/v0.1.0-alpha.0...v0.1.0-alpha.1) (2026-11-03)

### Features

* **Workouts:** plan a workout first (Basics, Introduction, Warm-o-rama, The Thang, Notes,
  Announcements, Words of Wisdom), then create its backblast from it with one button. The
  backblast copies the workout's sections onto its Workout page; each keeps its own Notes.
* **Backblasts:** step-by-step editor with autosave, drafts, standard sections, saved and default
  templates, typed attendance (downrange, FNG, 2.0), several Qs, a Notes section, and Event Data /
  Workout Details / COT layout; Copy and Share add a plain PAX list at the end.
* **Regions:** Google Sheets regions synced nightly into Supabase, with AOs by weekday (filling
  location, time and next date), roster suggestions, regulars and post / Q totals.
* **Lists:** swipe to archive or delete with Undo, an Archive page, and Search across workouts
  and backblasts with highlighted matches.
* **App:** F3 / FiA wording, light / dark / system themes and accent colours, rocket artwork and
  launch animation, installable app, menu navigation, settings, and a build number in the footer.

