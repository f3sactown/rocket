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
  workouts and backblasts (**Recent workouts** and **Recent backblasts**: your finished ones, not
  archived, dated within the last two months, the 5 newest of each; See all → has the rest; with none that recent, the section says so and
  that older ones are under See all). Drafts and your workouts and backblasts are listed by workout date, the
  most recent on top (undated ones last), here and on the Workouts and Backblasts pages, as are the Archive, Search results, PAX profiles, Discover's Newest and New backblast's choice of workout. Which of
  these show is chosen in Settings → Home screen (all but trending, to start).
  At the top right, next to "Hey, …", a heart and a reuse icon show the likes and reuses your
  finished workouts have had from others (private ones included).
- **Workouts** are written first: Basics (title, AO, date, time), Introduction, Warm-o-rama,
  The Thang, Notes and Words of Wisdom (CoT in FiA wording). The Workouts page lists only your own;
  others' public workouts are on Discover. Your finished workouts dated today or earlier show a
  **Needs backblast** badge (in lists and on Home, but never on Discover, and not once archived) until a backblast from them is
  finished; others' workouts never do.
  - The Thang can hold several thangs. Each can have a **timer** (Countdown, Stopwatch, AMRAP,
    Tabata (work and rest for a number of rounds; 20 seconds on, 10 off, 8 rounds to start) or EMOM) and **music** (a link to a song or playlist, shown in the output as 🎵 Title 🎵
    with the link on the next line).
  - A workout's **Notes** are private to its Q: stored in their own table only the author can read,
    and left out of anything copied or shared.
  - **Run workout** shows the whole workout to lead from (web addresses are clickable links), in Normal, Large or Extra large text, with
    each timer's countdown and each song as a button (♫ Title ♫) that opens its link. Like a Tabata timer, every stretch (each round's work and rest) ends with
    short beeps at 3, 2 and 1 seconds left and a long, louder beep at 0. The beeps share one audio context, started by the Start tap, which is what iPhones and iPads need to let a page make sound; there it also asks for "playback" audio, so the beeps sound with the ring/silent switch on silent (Safari 16.4 and later). Starting one timer pauses any other that's running. The timer in use pins to the top
    when scrolled away, and the screen stays awake. A stopwatch shows hundredths of a second. On the
    workout's day, five minutes before the end of its time (or 45 minutes after a start with no
    end), a **5 minutes left** banner with a beep says it's time to wrap up for COT. At the bottom, a **Close** button back to Home sits to the left of
    Create backblast (or Continue or Open backblast). Leaving the run of a finished private workout of
    yours any way (those buttons, the menu, the Rocket logo, any link, or back) first asks whether
    to make it public (Make public / Keep private), then goes on; closing the app can't be asked
    about. Tabata and EMOM timers take 1 to 99 rounds.
  - **Reuse** starts a new workout from an existing one, leaving the AO, location, date and time to
    choose again. Each workout shows how many times it's been reused by other Qs (counting archived copies; reusing your own doesn't count, just as you can't like your own).
    A reused workout credits the Q who wrote the first one (`workouts.original_author_id`), even
    when it's a reuse of a reuse: its page shows "Originally by" them and their region.
  - **Under the title**, in two columns: on the left "by Tinman" (the name opening their
    profile) with their region below (and "Originally by …" for a reuse); on the right the AO with
    the date below (`TitleMeta`). A workout's forecast follows, with "Weather by Open-Meteo" below
    it; a backblast's PAX, FNGs and Downrange counts follow.
  - **Authors link to their profiles:** the author's name (and "Originally by …"'s) is underlined
    in the accent color and opens that PAX's profile (`AuthorLink`: by name and their region's
    organization; yours too; just the name offline). The Q's name in the text stays
    plain. Someone else's workout ends with **Read backblast** once they've finished it.
  - A finished workout is **public** by default (Settings → Sharing can make new ones start
    private): anyone signed in can see, like and reuse it. Its Q
    can make it **private** on its page: it disappears for everyone else (Discover, Trending, lists
    and search) but keeps its likes and reuse count, which only its Q sees until it's public again. **Likes:** one per person, on other people's public
    workouts.
  - A public workout dated **after today** isn't listed for anyone else (Discover, Trending, PAX
    profiles, likes) until its day, in Pacific time. Its Q sees it as usual, and its link (Share
    link) opens it for anyone signed in, with Run workout and Reuse; likes open on the day. Saving
    one (**Done** on the review step) says so in a notice, and the workout's page
    then explains its Public / Private switch in another. Each notice closes with **OK**; ticking
    its **Don't show again** box first silences it (Settings → Notifications brings it back).
  - **Editing** a finished workout or backblast puts it back to a draft as soon as something
    changes (others stop seeing it), until **Done** finishes it again.
  - **Saving:** the workout and backblast forms save as you type. The top right shows "Saves as
    you type" on a new one, "Saving…" while it saves, then how long ago it was saved ("Saved just
    now", then in steps that grow as it sits: 5, 10 and 15 sec; every 10 sec to a minute; every
    15 sec to 2 min ("1 min 15 sec ago"); every 30 sec to 3 min; then every minute, then hours and
    days. One just opened shows "Saved" until it saves again). Scrolled down, past that header, a bar pinned to the top of what's visible (keyboard up too: it follows the visible area, `lib/visible-top.ts`) shows the title (or "New
    workout" until one is set), the same save status with its dot, and the page being edited
    ("Step 4 of 7 · The Thang"). The last page's button
    is **Done**, which finishes it. The Thang's boxes are all as tall as the screen allows for
    the first while its timer, music and Exicon buttons and "Add another thang" stay in view
    (worked out once, so adding a thang doesn't shrink the first).
- **Generate workout** (in the menu under New workout, and from the Workouts page): choose 2 to 5
  of the Exicon's tags, with the same From, All / Exercises / Routines and tag chips as the Exicon,
  and **Generate** puts a workout together at random from them (`generateWorkout` in
  `packages/core`): a Warm-o-rama of five warm-up exercises (those tagged Warm-Up and one of the
  tags first), then three thangs, each a routine or three or four exercises done as an AMRAP,
  EMOM, Tabata or rounds for time, with the timer for Run workout. Entries with more of the tags
  come up more often, and nothing repeats. Each exercise shows its Exicon description under it, easy to read; a **Descriptions** checkbox
  beside the Warm-o-rama and each thang shows or hides them for that section, and **Show
  descriptions** above does every section at once (a dash when some are on and some aren't).
  **Generate again** makes another; **Create workout from these** opens New workout with the
  Warm-o-rama and The Thang filled in, descriptions included where they're shown. It needs a connection.
- **Discover** shows public workouts from every other Q. At the top, a **From** picker chooses
  F3's, FiA's or both (the default), going by each author's region (authors with no region always
  show), and **Include my workouts** (off by default) adds yours; both are saved to your account.
  With yours included, a **My workouts** section ranks them by likes, then reuses. A **Liked by
  you** row lists every workout you've liked, most recently liked first, whatever the From choice
  (one made private since drops out). The
  rows, top to bottom, are Trending (likes and reuses on the
  last 30 days' workouts, newer ones weighted up), Newest, Most liked, Most reused, At your region's
  AOs, Liked by you and (with yours included) My workouts, each a row of tiles that scrolls sideways, naming each author and their region, with
  like buttons. The app tour's example workouts (titled "Example Q", `isTourExample`) are left off
  Discover, Liked by you and Home's Trending. Trending on Home follows the From choice and leaves out your own workouts, and
  scrolls sideways the same way. Rows that scroll sideways (here and throughout the app) show no scrollbar; with a mouse, arrow
  buttons at either end page through a row of tiles, and it can be dragged.
- **PAX** (in the menu, under Search) lists everyone on your region's roster (or every region's,
  when you've chosen all regions), plus every Rocket account whose name isn't on any roster of its
  organization yet (with no posts or Qs: under its own region, or, for an account that chose all of
  an organization's regions, under each of them with "All F3 regions" or "All FiA regions" in
  place of a region badge; one with no region at all shows as F3 under every region, marked "No
  region yet"), as tiles in alphabetical order (three across on a phone, four on larger screens), with a search box that matches
  names and an **Only PAX on Rocket** checkbox (saved to the account as `pax_rocket_only`) that
  leaves just the roster names with a Rocket account, matched as on their profile. Each tile shows the PAX's regions, posts and Qs (from the synced region stats, or read
  straight from the sheet for a region added since the last sync) and the
  total likes and reuses on their public Rocket workouts, with the same heart and reuse icons as
  workout tiles. A **From** picker of regions, in each
  region's color, narrows the list and the totals; the choice is saved to your account. A tile
  opens the PAX's profile, marked **On Rocket** at the top right when they have a Rocket account (or a dimmer **Not on Rocket yet**): posts, Qs, likes and reuses in one row on top, their stats per region and their Trending workouts, then **All workouts** and **All backblasts** (every public one, newest first, each with **See all →** opening the full list on its own page, `/pax/list`;
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
  its Q's PAX profile. Its Q can switch it to **private** on its page. A backblast linked to
  its workout **shares** it: the title, basics (date, AO, address, time) and sections
  (Introduction, Warm-o-rama, The Thang with its timers and music, Words of Wisdom) are the same
  in both, and a change to either is made to the other (the backblast's Workout page says so). Its pages are Workout, Notes, Name-o-rama (Qs and
  PAX, with roster suggestions and the AO's regulars), Announcements (optional; the backblast's own, not
  copied from the workout), Coffeeteria (CoFiA in FiA wording) and Review (to check it over; Copy
  and Share are on the finished backblast's page). On a finished backblast's page, the Public /
  Private switch sits on the right below the counts (its workout is reached by **Open workout**
  at the bottom); Copy, Share and Edit share one row, with **Close** (back to Home) below, and beside it
  **Open workout** when the backblast has a workout.
  - **Linking to a workout:** a backblast without a workout links on its own to its Q's one
    finished workout at the same AO on the same date (ignoring case and spaces) that has no
    backblast, and a workout that's finished links its Q's one such backblast (triggers in
    `20261110010000_backblast_workout_links.sql`, changed by
    `20261117000000_backblast_shares_workout.sql`). With two matches it doesn't guess. One
    without a workout shows **Link to a workout** on its page (matches first). Once linked, they
    stay linked: changing the AO or date of either changes both. The sharing is done by the
    database too (`backblasts_share_workout` and `workouts_share_backblasts`): on linking, what the
    backblast has goes to the workout and what it hasn't is filled from the workout; after that,
    each change to the shared parts is made to the other. A backblast keeps the Thang's thangs
    (`thangs`) like a workout.
  - A backblast waits for its workout: until the workout's date, **Create backblast** is greyed
    out with the reason, and New backblast shows that workout greyed out with the date it opens.
  - **Copy** and **Share** produce Band- and Slack-ready text (Event Data, Workout Details, COT), ending with a
    plain comma-separated list of everyone who posted.
  - **Conditions** (on the backblast's Workout page, below the basics): the weather at the AO when
    the workout started, e.g. "48°F (feels like 41°F), overcast, wind 12 mph". Once the workout's
    day has come it fills in on its own (when blank), **Use the weather at the AO** fills it in
    again, and it can be typed over. It's the backblast's own (`backblasts.weather`, not shared
    with its workout), and the copied text has it in Event Data on its own
    line between the place and Total Attendees (`Weather: …`). When it's blank, the backblast's
    page and its copied text use the weather at the AO for the workout's time instead. See [Weather](#weather).
  - On a finished backblast's page, **Copy**, **Share** and copying the text on screen all give
    exactly the same text, including the link to its workout. Share sends only that text (no
    separate title), and Copy and Share wait the moment it takes to check the workout is public.
- **Exicon:** at the top right of a workout's Warm-o-rama, and with each thang on The Thang,
  **Exicon** opens the F3 and FiA Exicons together: search, choose the source (F3, FiA or both),
  Exercises / Routines and tags (tags that differ only in case, like "Warm-Up" and "Warm-up", are
  one tag; on a phone, two rows of tags that scroll sideways), read an entry, and add it by name or with its description. Each
  entry carries a badge: F3 in F3 red, FiA in FiA teal, and a region's own entries in that region's
  color. Each region gets a color in the order regions were added (blue, then pink, violet, amber, lime and on), so it's the same for every user.
  On the light theme the badges and source chips use deeper shades with white text.
  The **Exicon** page (in the menu, under Discover, at `/exicon`; the old `/library` address goes there) browses the same entries on their own, with
  Copy and Copy with description in place of Add.
- **Templates:** each text section (all but Notes and the Name-o-rama) can be saved as a template,
  and one per section can be starred as the default that fills new workouts or backblasts. The
  Introduction also offers a built-in template: **F3 standard** (welcome, the three Fs, mission,
  five core principles, disclaimer and credo) in F3, or **FiA Disclaimer** in FiA. A built-in
  template can be starred as the default too (saved as `builtin_defaults` in the account's
  metadata); starring one clears the section's other default.
- **From pickers** (Exicon, PAX, Discover): on a phone, one line of chips that scrolls sideways.
- **Tutorial:** a step-by-step tour that spotlights one part of the screen at a time, moving
  between pages as it goes. After Home's stats and sections, it walks the user through writing a
  real workout, dated today (the date can't be changed, so its backblast can follow), titled
  **Example Q** at the first AO on the region's list (both filled in, and changeable): it opens
  each page of the form in turn (Basics, Introduction, warm-up, The Thang, Notes, words of
  wisdom) while they fill it in, then Review. Every step has the tour's **Next**; on the Review
  and Done steps it taps the page's Done (the card sits at the top there, clear of it). On to that workout's page
  (Run workout, Copy and Share), then **Create backblast**, and the same for its backblast (the
  copied workout, Notes, Name-o-rama, Announcements, Coffeeteria, Review and **Done**), ending on
  Copy and Share.
  Then Discover, the Exicon and PAX (searching names, e.g. before naming an FNG, and the profile
  of a PAX with at least one public workout and backblast). While the user fills in a page, the
  page stays usable around the tour's card, and notices wait until the tour is over. The form
  doesn't put the cursor in each page's box while the tour opens them (so a phone's keyboard
  doesn't come up on each); writing one normally, it does. It starts
  once per account, after the device setup (`tutorial_done` in the account's metadata), can be
  skipped, and **Settings → Tutorial** shows it again.
- **Offline:** the service worker (`apps/web/public/sw.js`) keeps the whole app on the phone,
  version by version: each build registers it under its own address (`sw.js?v=<build>-<commit>`,
  `SERVICE_WORKER_URL` in `lib/push.ts`), so the phone installs the new one, which keeps every file
  listed in `precache.json` (written after `next build` by `apps/web/scripts/precache.mjs`: every
  page, the data files Next.js loads when moving between screens, and the code) in its own cache
  (`rocket-app-<version>`). It only takes over once they're all kept, so every screen opens offline
  and they all match; the version before is kept too, for a screen still open on it. It also keeps
  the data you've looked at, so a workout you've opened before can be read and run offline.
  **Always on the phone** (`lib/pocket.ts`, `PocketKeeper`): whenever there's a connection (on
  opening Rocket, on reconnecting, every 10 minutes, and a few seconds after a save), Rocket fetches
  your recent workouts and backblasts whole (the 60 newest finished of each and 30 drafts, with
  workouts' private notes and what you've archived) and the whole Exicon, and keeps them. Offline,
  every screen goes straight to them rather than waiting on the network: Home's lists, the
  Workouts and Backblasts pages (which say they show your most recent and the rest come back with
  the connection), a workout or backblast's page, Run workout, the editors, and New backblast,
  whose choice of workout comes from them (a backblast offline can be written for any of those
  workouts, with the workout's copy). With a connection everything loads fresh as usual. Rocket also keeps copies of screens
  by opening them in turn in a hidden frame (`lib/offline.ts`), in order: first the screen you've
  just left (a workout's page brings its Run workout screen, and the other way round), including
  on putting Rocket away; and, forced even if kept recently, any workout or backblast saved since
  (its pages, its workout's, and the Workouts or Backblasts list). Then, once you've stayed on a
  screen for 4 seconds, the rest from Home: the main screens that work offline (Workouts,
  Backblasts, the new workout and backblast forms, the Exicon), your upcoming workouts and those from the last two weeks with their Run
  workout screens, and your recent backblasts. A screen kept in the last 3 hours isn't kept again
  unless it's changed; what's waiting is kept on the phone (`rocket-offline-queue`) so closing
  Rocket picks it up next time (not in Data Saver; it waits for the service worker on a first
  visit). Offline, a sign-in Supabase can't renew (they last an
  hour) still counts: the account and its access token are kept on the device
  (`rocket-offline-user`, `rocket-offline-token`). Offline, Supabase keeps trying to renew an
  expired sign-in for about half a minute; Rocket waits 3 seconds, then carries on as the kept
  account, and data requests go ahead with the kept token (`lib/supabase/client.ts`: sign-in is
  Supabase's own client, data requests a second one that asks it for the token), so kept copies
  answer at once. Data requests aren't retried when they can't reach the server (Supabase would
  wait 1, 2 then 4 seconds more). Home's posts and Qs are kept on the device too (`rocket-totals:*`) and show
  offline as last seen; the likes and reuses top right say **Offline** instead, as they're only
  counted fresh. **Kept copies** (`lib/kept.ts`): the regions, your region's AOs, roster,
  regulars and totals, your section templates and the whole **Exicon** keep their last answer on the device (Cache Storage, `rocket-kept-v1`, dropped on signing out),
  not tied to the exact request, so a screen that asks a little differently after an update or on
  another day still finds it; each is loaded fresh when there's a connection. Home shows each of
  its lists that's kept even if another isn't, and with none kept it says so and that a new
  workout or backblast can still be written. Your region isn't taken for "none" offline, so Home
  doesn't ask you to choose one. The **Exicon** (`/exicon`) works offline (its screen, and the forms'
  Exicon buttons), fetched with your recent workouts whenever there's a connection. Discover,
  Generate workout, Archive, Search and PAX need a connection: offline, the menu shows them
  greyed out ("Offline") and opening one says **Needs a connection**
  (`components/offline-gate.tsx`); so does **Settings**, as changes to your account need a
  connection. **About** works offline. New backblast offline with no workouts on the phone says to
  start it **Without a workout**, and it links up with the workout at its AO and date once it
  reaches Rocket. Your region's AOs and roster, and the regulars at the AOs of your recent
  workouts, are fetched with them too, for the forms offline; one that isn't on the phone says so
  rather than showing an error (the AO list: type the AO instead; Name-o-rama's regulars: they show
  once you're back online).
  Data asked for with today's date (Home's "up to today" and "after today" lists, Today's
  workouts) is also kept under its address with the dates taken out, so offline on a later day
  the latest kept answer still shows. A page asked for without its trailing slash (`/workout?id=…`, which the site
  redirects to `/workout/?id=…`) is found under the address with it. A workout or backblast that
  isn't kept says so offline ("Not kept on this phone") rather than "not found". Pages and data
  are fetched fresh when there's a connection (a kept copy is used offline, or after 5 seconds on a
  slow one). Rocket doesn't wait for the phone to say it's offline (with a weak or dead signal
  that can take a long while): once a request has to use a kept copy, the service worker tells
  the app (`lib/connection.ts`) and the **Offline** banner shows; from then on kept copies answer
  at once, with fresh ones fetched alongside (the worker is kept running until they answer), until
  one gets through. To notice the connection coming back, the app also asks Supabase's server
  directly (bypassing the service worker): straight away, every 5 seconds while offline, when the
  phone says it's online, and on returning to the app; any answer tells the service worker first (so what loads next is fresh, not a kept copy), then
  clears **Offline**, and the screen loads its data again; not the workout and backblast forms or
  Run workout, where you'd lose your place (they save once they can). A request waiting more than 1.5 seconds shows **Checking connection…** at the top,
  and the workout, Run workout and backblast screens say "Waiting for a connection… the copy
  saved on this phone shows in a moment". A request with no kept copy gives up after 15 seconds
  (at once when already offline), except a page itself; signing out drops the kept data. **Signing out offline** first says what it means (`SignOutOffline`): you can't sign back in until you're online, the copies kept for offline use are removed, anything written offline that hasn't reached Rocket stays on the phone and is saved once you're back in that account with a connection, and everything is fetched fresh after. It signs out on the phone only (Supabase can't be told offline). What's kept on the phone notes whose it is, and is only sent, listed or reopened for that account. An **Offline** banner says what still works, and the accent color (buttons, outlines, the rocket) turns grey until the connection's back (`<html data-connection>`). The workout and
  backblast forms keep a copy of what's typed on the phone (`rocket-unsaved:*` in local storage)
  until it's saved, so a dropped connection or a closed app loses nothing: the status shows
  "Offline · saved locally" (or, with a connection that failed, "Not saved yet · kept on this
  phone"), it saves again when the connection returns, and opening the
  same one later brings the kept copy back and saves it. **Drafts offline:** workouts and
  backblasts can be written with no connection at all (`lib/local-drafts.ts`). A new one gets an
  ID on the phone (its address becomes `/workouts/new?local=…`), is listed on Home and on the
  Workouts or Backblasts page under **On this phone** ("Saves once online"), and is sent to Rocket
  as a draft as soon as there's a connection (`DraftSender`: on opening, on reconnecting, and
  every minute), then joins the lists. **Done** offline closes it and goes to Home: with changes made, they're kept on the phone as a
  draft and Home says so ("added to your drafts … saved to Rocket once you're back online", a
  one-time note, `lib/flash.ts`); what a finished one needs (title, date, AO, the Q) isn't asked
  for until it's finished with a connection. (One kept as finished by an earlier version,
  "Finishes once online", is still finished when it's sent.)
  Offline, a workout's **Review** page has **Run workout** below Done, which runs it from what's
  typed on the phone: one not in Rocket yet by its phone ID (`/workout/run?local=…`; ← Workout
  goes back to its form), one already there with any changes made offline. A new one
  is created in Rocket under the phone's ID for it, so sending it twice (the app closed or moved
  on just as it was sent) can't make two: the second finds it there and saves the latest to it. Changes
  to one already in Rocket are sent the same way, unless it's been saved since from somewhere
  else. An open editor sends its own; the hidden frames that keep copies never save. To write a
  backblast offline, the new-backblast form is kept for each of your workouts that has happened
  (with the workout's copy, the roster and the AO's regulars), along with the new workout and
  new backblast forms.
- **Admin** (in the menu for admins only, below Settings; needs a connection): **People** (search
  everyone by name or email; change a name, still one per region, on their profile and account;
  change their region; make or remove admins; **Export** their data, the same file as Settings →
  Your data, and **Import** one into their account, adding what isn't there and keeping what is,
  with their settings, name and region too if ticked; **Remove from Rocket**, typing REMOVE,
  which deletes their account and everything they made, not for yourself or another admin),
  **Regions** (each with its color as on the Exicon and PAX pages; add, change and remove them, with how
  many people have each and its last sync; a removed region's people are asked to choose one
  again, their workouts and backblasts untouched) and **Activity** (every admin change, who made
  it and when, `admin_log`). Admins are the `admins` table; the database checks every change
  (`is_admin`, `admin_people`, `admin_set_name`, `admin_set_region`, `admin_set_admin`,
  `admin_remove_user`, `admin_export_user`, `admin_import_user`; only
  admins may add, change or remove regions). No one can remove themselves as an admin, and the
  last admin stays. The first admin is added in the SQL Editor:
  `insert into public.admins (user_id) select id from auth.users where email = '…';`. A change to
  someone shows on their phone once Rocket refreshes their sign-in (within an hour) or they sign
  in again.
- **About** (last in the menu): what Rocket is and everything it does, **Contact the developer**
  (a `mailto:contact@f3sactown.com` link that opens the phone's mail app, its subject naming the
  version and build), the running version and build, and the **Changelog**: every release from `CHANGELOG.md` (read when the site is built), newest first and
  open, the rest folded; commit links and repeated lines are left out.
- **Lists:** swipe to archive or delete (directions set in Settings), with Undo (a delete happens once Undo goes, or on leaving the screen). A swiped delete leaves every section on the screen at once (Home's Today's workouts too), and Undo brings it back. Once a delete, archive or unarchive is done, Home and the Workouts and Backblasts pages load their lists again, so one finished just as another screen opened doesn't leave it showing. Archiving hides a
  workout or backblast only from your own Workouts and Backblasts lists (and Home's Recent lists);
  everywhere else (Today's and Future workouts, New backblast, Discover, Trending, PAX profiles) it
  still shows unless it's private. **Archive** lists what you've archived, by workout date (newest first); **Search** finds workouts and backblasts by any word, with matches
  highlighted.
- **Testing banner:** while the version is an alpha or beta (`0.1.0-beta.1`, so it reads **BETA**), a slim bar across the
  top of every screen says Rocket is being tested and things may change or not work as expected, and asks people to contact the developer with any issues;
  it goes away by itself with the first full release.
- **Continue with Google:** the sign-in screen leads with Google: one **Continue with Google**
  button, with a small **Sign in or sign up with email** link under it that opens the email and
  password form (sign up and forgot password included), which has **Use Google instead** to go
  back. Google signs in or signs up with no password. The
  first time, a **Welcome** step asks for your region and then your F3 name (Google gives your
  real name and no region, and Rocket matches PAX to their roster by F3 name), then you're in.
  Signing up with email asks for the same two first. Either way the name is picked from the chosen region's roster (suggested as you type; read
  from the region's sheet when signing up with email, as the synced roster needs a sign-in; names
  already taken by a Rocket account are left out after Google), and only a roster name is
  accepted unless **I'm not on the roster yet** is ticked. **One account per name in a region**
  (there's one Casper of F3 SacTown; another region can have its own): the database holds to it
  (`profiles_name_per_region`, names compared trimmed and ignoring case; accounts with no region
  or all F3/FiA regions aren't held to it), and sign-up, Welcome, Settings → Profile and choosing
  a region in Settings say "That name is already taken … by someone on Rocket" rather than saving
  it. Sign-up asks the database first with `name_taken`, which answers only yes or no, so it works
  before there's an account. Two people signing up with the same name at the same moment: the
  second account is made without its region (rather than the sign-up failing), and they choose
  it again. It comes with a warning that it must
  match the database (the roster) exactly and can't be changed once the account is set up, and the first tap shows it back ("You'll be …
  on Rocket, for good") to confirm with a second. Settings shows it but doesn't let it change, unless it's no longer on your region's roster
  (renamed or corrected there; `name_on_roster` in the account remembers it once was): then a warning at the top of each screen says so, with **Fix it
  in Settings** (and **Not now**, until Rocket next opens), and Settings → Profile lets you choose
  your name again from the roster (not one taken on Rocket), confirmed the same way. A name that's never been on the roster (someone new, not added yet) gets a
  gentler note instead: once it's on the roster, choose it in Settings. The top bar and menu stay hidden until the Welcome step is done (it has **Not you? Sign out** instead). Signing in with
  Google using the same email as an existing account opens that account. The F3 name is also kept
  as `f3_name` in the account, since each Google sign-in overwrites `name` with the Google name.
  Setup: see "Google sign-in" below.
- **Forgot password:** Sign in → **Forgot password?** emails a reset link (Supabase's built-in
  mailer and standard template, no custom SMTP needed). The link opens `/reset-password` on any
  device, signed in for the reset, where you choose a new password. Supabase → Authentication →
  URL Configuration must have the site as the Site URL and under Redirect URLs.
- **Settings:** a **Display name** in Profile (`display_name` in the account; Home's "Hey, …" only; it starts as and defaults back to your name, and the note under it shows your name in the database, which it doesn't change: that one's set at sign-up), region (right below the profile), email, password, organization (F3 or FiA, which also sets the app's words: Warm-o-rama, The Thang, Coffeeteria and Reuse, or Warm-up, The Workout, CoFiA and **R&R** everywhere Rocket says reuse, the copied workout link and the "… R&R'd your workout" notification included (`termsFor` and `inTermsOf` in `@rocket/core`); set by a shared region, so it's
  locked while you have one, and free to choose with no region or one you added), theme, accent color (Red, Teal, Blue, Green, Orange or Violet; saved to the account as `accent`, so it follows you to every device; the first region you choose sets Red for F3 or Teal for FiA, and later region changes leave it alone), the launch
  animation, what Home shows (every section, Trending included, until you choose),
  swipe directions, and **Sharing**: whether new workouts and new backblasts start public or private,
  and whether a copied or shared public workout, or backblast from one, ends with
  a link to that workout asking PAX to like and reuse it (a few lines below the text, and on a
  backblast right above the hidden PAX list; on by default, never shown on screen). **Install the
  app** says whether Rocket is installed on this device and, if not, shows how (the browser's
  **Install Rocket** button where it offers one, otherwise the steps for the device). **Notifications** turns on push notifications for the device and
  chooses which come and when (see [Push notifications](#push-notifications)), and lists the
  notices you chose not to show again (`notices_off` in the account's metadata, included in
  exports), with **Reset notifications** to show them all again.
- **Copying:** the backblast and workout text on their pages and on the review step can't be
  selected, so it's copied with Copy or Share. If a copy takes it in anyway (Select All), it gets
  exactly what Copy gives, link and PAX list included. **Your data** exports everything you have
  (settings, including the Discover and PAX pickers, workouts with their notes, backblasts, saved templates, archive and likes) as a JSON
  file, and imports one back: it shows what's new and, for workouts, backblasts or templates you
  already have, lets you keep yours, replace them or keep both (settings are optional; they bring your F3 name
  from `f3_name`, not `name`, which signing in with Google sets to the account's real name). **Reset
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
- **Link previews:** a Rocket link texted or posted in a chat shows Rocket's icon, a title
  ("Workout on Rocket", "Backblast on Rocket", or "Rocket") and a short description, from the
  pages' Open Graph tags. The image needs the site's full address, which the deploy workflows pass
  as `NEXT_PUBLIC_SITE_URL` (production: the Pages address; dev: rocket-dev.f3sactown.com).
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
  sync-exicon.mjs   Weekly copy of the F3 and FiA Exicons into Supabase for the Exicon
  users-report.mjs  Daily email summarizing production's accounts
supabase/
  config.toml     Local Supabase settings
  migrations/     SQL migrations: tables and row-level security policies
  functions/      Edge Functions: push-reminders sends push notifications
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
- Others' public workouts are readable from their date on (Pacific time). Before that, only
  `shared_workout(id)` returns one, for its link: a finished public workout by its ID (random, so
  only those given the link have it), or your own.
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

**Continue with Google** is Rocket's own button. It opens Google's sign-in page, which comes back
to Rocket's own address (not the Supabase project's, so Google names Rocket's site) with a signed ID
token in the address; `supabase.auth.signInWithIdToken` checks it and signs in, and the token is
cleared from the address bar. It's a plain page-to-page step, so it works the same on phones. A
random state and nonce guard each sign-in (the state must match the one the tab sent; Google gets
the nonce's SHA-256, Supabase checks the original). If the build has no
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, the button uses Supabase's redirect sign-in instead. Nothing in the
app holds Google secrets. It needs a Google OAuth client, then the Google provider turned on in each Supabase project
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

   Add the sites Google returns to, also under **Authorized redirect URIs**, each with its
   trailing slash: `https://rocket.f3sactown.com/`, `https://rocket-dev.f3sactown.com/`, and
   `http://localhost:3000/` for local work. **Authorized JavaScript origins** can stay empty.
   Create it, and copy the **Client ID** and **Client secret**.

5. **Supabase, in each project** (rocket, then rocket-dev): Authentication → **Sign In /
   Providers** → **Google** → turn on **Enable Sign in with Google**, paste the client ID and
   secret, and **Save**. Leave "Skip nonce checks" off.
6. **Return addresses, in each project:** Authentication → **URL Configuration**. The **Site URL**
   is the site (`https://rocket.f3sactown.com/` for production, `https://rocket-dev.f3sactown.com/`
   for dev), and the same address is under **Redirect URLs** (it already is for email sign-up).
7. **Client ID for the button:** in this repository, Settings → Secrets and variables → Actions →
   **Variables**, add the repository variable `GOOGLE_CLIENT_ID` with the client ID (it isn't a
   secret: it's in every page). The production and dev builds pass it to the app as
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID`; for local work, put it in `apps/web/.env.local`.
8. **Try it on dev first:** open rocket-dev.f3sactown.com, choose **Continue with Google**, pick
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
  `supabase/migrations/20261107010000_f3_delta_region.sql`, **F3 DryCreek** (F3) by
  `supabase/migrations/20261108000000_f3_drycreek_region.sql` (its Sites tab has no address
  column, so the AO's Location is used), **F3 Iron Corridor** (F3, the default settings) by
  `supabase/migrations/20261120000100_f3_iron_corridor_region.sql` and **F3 Plumas Lake** (F3) by
  `supabase/migrations/20261121000000_f3_plumas_lake_region.sql`. Others are added by admins on the **Admin** page (with a **Check sheet** button that
  confirms every column exists); Settings only chooses one.
- **Nightly sync:** `.github/workflows/sync-regions.yml` runs `scripts/sync-regions.mjs` every
  night (about 2–3am Pacific, or on demand from the Actions tab). It copies each region's active
  AOs, roster, regulars per AO (last 3 months), all-time totals per PAX and the newest post date
  into Supabase, and the app reads those. A region that hasn't synced yet is read from its sheet live. A failed sync keeps
  the previous copy and shows the error in Settings. Then it looks up where each AO is, for its
  weather (see [Weather](#weather)).
- **Placeholders and retired PAX:** a name like "Site Closed (Archived)" that a sheet puts in the
  PAX column to mark a closed AO isn't a PAX, and a PAX marked retired ("007 (Retired)") is hidden
  too, and so is a sheet's "last updated" note kept as a row (PAX "UPDATED 1/8/2025", as F3 Iron
  Corridor's Master Data has): all are left out of rosters, the PAX page, Name-o-rama suggestions,
  regulars, PAX totals and the names to choose at sign-up (`isPlaceholderPax` in `@rocket/core`;
  the sync does the same). Attendance rows dated after tomorrow (that note is dated 1/1/2099)
  aren't posts either: they're left out of the regulars and the region's latest post date.
- The sync needs the repository **secret** `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project
  Settings → API Keys → secret key) alongside the `SUPABASE_URL` variable.
- Sheets are read with Google's Visualization API (`apps/web/src/lib/sheets.ts` in the app,
  `scripts/sync-regions.mjs` for the sync), so only the rows a query needs are downloaded.

## Exicon library

Rocket's Exicon is a weekly copy of two Exicons:

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

## Push notifications

Rocket sends notifications to phones and computers with **Web Push**: a service worker
(`apps/web/public/sw.js`) shows them (with `icons/badge-96.png`, a white rocket on clear, as
Android's small status-bar icon; its source is `icons/badge.svg`), and the `push-reminders` Edge Function
(`supabase/functions/push-reminders`) sends them. Each PAX turns them on per device in **Settings →
Notifications** (`push_subscriptions`) and chooses, for all their devices
(`notification_settings`, with the device's time zone):

| Notification                      | Default                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| The day before your workout       | On, at 6:00am                                                          |
| Before your workout starts        | On, 40 minutes before its start time                                   |
| Write the backblast               | On, 30 minutes after it ends, if its backblast isn't finished          |
| Finish a draft                    | On, 2 days after it's started; a 2nd (4 days) and 3rd (6 days) are off |
| Likes and reuses of your workouts | On                                                                     |
| A new PAX in your region joins    | On                                                                     |

The day-before reminder ends with the forecast at the AO for the workout's start (`Forecast: 48°F,
overcast, 60% chance of rain.`), when Rocket knows where the AO is; without it, it goes as before.

Workout reminders are for the Q's own finished workouts; times are read from the workout's time
(like `5:15am-6:00am`; one with only a start counts as 45 minutes). Every 5 minutes the database
(pg_cron) calls the function, which sends what's due and logs each one (`notification_log`) so
nothing goes out twice. The schedule is in `supabase/functions/_shared/reminders.ts` (tested in
`packages/core`).

**iPhone and iPad** only offer notifications to Rocket added to the Home Screen (Share → Add to
Home Screen) and opened from there; Settings says so.

**Setting up a device:** the first time someone is signed in on a device, a short setup walks
them through it, one step at a time:

1. **Install Rocket**, unless it's already running as an app: an **Install Rocket** button where
   the browser offers one (Chrome and Edge), or the steps for the device (Share → Add to Home
   Screen on iPhone and iPad; the browser menu on Android; the address bar or File → Add to Dock on
   a computer).
2. **Turn on notifications**: a switch for this device (off and on again if they stop arriving),
   with **Send a test** once they're on. On iPhone and iPad it (and Settings → Notifications) also
   warns of their limits there: Home Screen app only (iOS 16.4 or later), removing the app stops
   them, Focus and Low Power Mode can hold them back, and iOS can stop them for an app left unopened.

Each step can be skipped. **Remind me later** puts it off for a day (it opens again the first time
Rocket opens after that). Finished or skipped, it doesn't come back on that device
(`rocket-device-setup` in local storage); **Set up this device again** in Settings →
Notifications runs it again. On iPhone, the Home Screen app keeps its own storage, so opening it
from there picks up at the notifications step.

### Setting it up (once per Supabase project: dev and production)

1. **Keys:** run `npx web-push generate-vapid-keys`. In Supabase → Edge Functions → Secrets, add
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (`mailto:` and an address people
   can reach). The same pair can serve both projects. Changing the keys means each device turns
   notifications on again.
2. **The function:** with a GitHub secret `SUPABASE_ACCESS_TOKEN` (Supabase → Account → Access
   Tokens), the dev and Pages workflows deploy it to their project. Without it, deploy it by hand:
   `supabase functions deploy push-reminders --project-ref <ref> --no-verify-jwt`.
3. **The schedule:** the migration schedules the call, which needs the project's address in the
   Vault. In the SQL Editor:
   `select vault.create_secret('https://<ref>.supabase.co', 'project_url');`
   Until it's there, nothing is sent.

## Weather

Weather comes from [Open-Meteo](https://open-meteo.com) (free, no key; credited wherever it's
shown), in °F and mph, for the hour nearest the workout's start (6am for one with no time). The
helpers are in `supabase/functions/_shared/weather.ts` (used by the app and the push function,
tested in `packages/core`).

- **Where each AO is:** the nightly region sync looks each AO's address up once: the street
  address after its name with the US Census geocoder, else the place itself on OpenStreetMap
  (Nominatim, one request a second). It keeps the coordinates in `place_coordinates`, keyed by the
  address trimmed and in lower case (readable by anyone signed in). One that can't be found is
  kept without coordinates and tried again after 30 days; at most 150 are looked up a night. A
  workout at an AO typed by hand (no address from the region's list) has no weather.
- **Workout page and Run workout:** the forecast at the AO for when it starts, from a week ahead
  (**Forecast: …**), and once its day is past, what the weather was (no label, for up to
  three months). The last one found is kept on the phone for offline use.
- **Backblast:** its **Conditions** line (see above).
- **Day-before reminder:** the forecast, added to the notification.

## Daily users email

`.github/workflows/users-report.yml` runs `scripts/users-report.mjs` every morning (13:37 UTC:
about 5:37am Pacific in winter, 6:37am in summer; or on demand from the Actions tab). It reads
**production** only (the repository's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, never the
`development` environment's) and emails one message:

- the subject has the date and how many accounts are new (joined in the last 24 hours) and in all;
- a line of totals, then **New in the last 24 hours** and **All users**, newest first, each with
  name, region (or "All F3/FiA regions"), email masked to its first and last 6 characters
  (`jonath…il.com`; the full address never leaves the script), date joined, finished workouts and
  backblasts, and the likes and reuses other PAX gave their finished workouts (as Home counts
  them).

It sends through Gmail's SMTP server with an app password. Add these repository **secrets**
(Settings → Secrets and variables → Actions):

| Secret                 | What                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `REPORT_SMTP_USER`     | The Gmail address it sends from                                                                                                            |
| `REPORT_SMTP_PASSWORD` | A Google **app password** for that account (Google Account → Security → 2-Step Verification → App passwords; needs 2-Step Verification on) |
| `REPORT_EMAIL_TO`      | Where it goes (commas for several)                                                                                                         |

Another provider works too: set `REPORT_SMTP_HOST` and `REPORT_SMTP_PORT` (TLS, e.g. 465) in the
workflow. To see the email without sending it, run the script with `REPORT_OUT=email.txt`.

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

Rocket is in **beta** (`0.1.0-beta.N`; it was in alpha up to `0.1.0-alpha.7`); the running version and build number show in the footer.
Versions and the [changelog](CHANGELOG.md) are meant to be managed automatically from commit
messages (see [RELEASING.md](RELEASING.md)). Until GitHub Actions is allowed to open pull requests
(Settings → Actions → General), each release is bumped by hand.

## License

[GPL-3.0](LICENSE)
