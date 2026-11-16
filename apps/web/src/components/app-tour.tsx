"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-provider";
import { ensureExamples } from "@/lib/examples";
import { DEVICE_SETUP_DONE_EVENT, deviceSetupFinished } from "./device-setup";

/**
 * The app tour: a step-by-step walk through Rocket that spotlights one part of a page at a time,
 * moving between pages as it goes. The main tour runs once per account (after the device setup);
 * the backblast tour runs once, the first time Home shows a workout that needs its backblast.
 * Settings → Tutorial runs them again.
 */

type TourName = "main" | "backblast";

interface Step {
  /** The page the step is on (the tour goes there first); none to stay where the last step left. */
  route?: string;
  /** The `data-tour` name of what to spotlight; none for a card in the middle of the screen. */
  target?: string;
  title: string;
  body: string;
  /** Run before looking for the target, e.g. to open a page of the workout form. */
  before?: () => void;
  /** Leave the step out when its target isn't on the page (e.g. a Home section that's hidden). */
  optional?: boolean;
}

const TOUR_EVENT = "rocket-tour";
/** Asks the PAX page to show tiles down to the PAX the tour opens (it may be far down the list). */
export const TOUR_SHOW_PAX_EVENT = "rocket-tour-show-pax";

/** Starts a tour now (from Settings). */
export function startTour(name: TourName = "main") {
  window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: name }));
}

const find = (target: string) =>
  document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
const click = (selector: string) => () =>
  document.querySelector<HTMLElement>(selector)?.click();

const MAIN: Step[] = [
  {
    route: "/",
    title: "Welcome to Rocket",
    body: "A quick tour of how to plan a workout, run it at the AO, and write the backblast. It takes about a minute; skip it any time.",
  },
  {
    route: "/",
    target: "home-stats",
    title: "Your stats",
    body: "The likes and reuses other PAX have given your workouts, added up.",
  },
  {
    route: "/",
    target: "home-totals",
    optional: true,
    title: "Posts and Qs",
    body: "Your posts and Qs, from your region's sheet. Choose your region in Settings if it's not set.",
  },
  {
    route: "/",
    target: "home-today-s-workouts",
    optional: true,
    title: "Today's workouts",
    body: "Your workouts for today. Tap one to run it at the AO.",
  },
  {
    route: "/",
    target: "home-your-drafts",
    optional: true,
    title: "Your drafts",
    body: "Workouts and backblasts you've started. Everything saves as you type, so you can pick up where you left off.",
  },
  {
    route: "/",
    target: "home-future-workouts",
    optional: true,
    title: "Future workouts",
    body: "Workouts you've planned for after today. Other PAX see them on the day, or sooner if you send them the link.",
  },
  {
    route: "/",
    target: "home-trending-workouts",
    optional: true,
    title: "Trending workouts",
    body: "Workouts other PAX are liking and reusing lately. Tap one to look, like it or reuse it.",
  },
  {
    route: "/",
    target: "home-recent-workouts",
    optional: true,
    title: "Recent workouts",
    body: "Your latest workouts. Once one has happened, a Needs backblast badge says it's time to write it up.",
  },
  {
    route: "/",
    target: "home-recent-backblasts",
    optional: true,
    title: "Recent backblasts",
    body: "Your latest backblasts. Choose which sections Home shows in Settings → Home screen.",
  },
  {
    route: "/",
    target: "home-new-workout",
    title: "Create your first workout",
    body: "New workout starts one. Let's look inside.",
  },
  {
    route: "/workouts/new",
    target: "editor-steps",
    title: "A workout, page by page",
    body: "Basics, Introduction, Warm-o-rama, The Thang, Notes, Words of Wisdom, then Review. Tap a dash or use Next to move between them.",
  },
  {
    route: "/workouts/new",
    target: "editor-page",
    before: click('[aria-label="Go to Basics"]'),
    title: "Basics",
    body: "The title, the AO (from your region's list, which fills in the address and time), the date and the time. The start time is when your reminders count from.",
  },
  {
    target: "templates",
    before: click('[aria-label="Go to Introduction"]'),
    optional: true,
    title: "Templates",
    body: "Save any section as a template and load it next time. Star one, like the built-in F3 standard introduction, to fill it in on every new workout.",
  },
  {
    target: "editor-page",
    before: click('[aria-label="Go to The Thang"]'),
    title: "The Thang",
    body: "Add each thang, with a timer if you like (Countdown, Stopwatch, AMRAP, Tabata or EMOM) and a song. The Exicon button adds exercises from F3's and FiA's lists.",
  },
  {
    target: "editor-page",
    before: click('[aria-label="Go to Notes"]'),
    title: "Notes",
    body: "Notes for you as the Q only. They're never shown to anyone or copied.",
  },
  {
    target: "editor-save",
    before: click('[data-tour="editor-skip"]'),
    title: "Review and Done",
    body: "It saves as you type, so there's no Save button: check it over and tap Done when it's ready. From its page you can Copy or Share it to Band or Slack, Run it at the AO with its timers, and make it public or private.",
  },
  {
    route: "/discover",
    target: "source-chips",
    title: "Discover",
    body: "Public workouts from other Qs. From chooses F3's, FiA's or both.",
  },
  {
    route: "/discover",
    target: "discover-include",
    title: "Your own, too",
    body: "Tick this to see how your workouts rank alongside everyone's.",
  },
  {
    route: "/discover",
    target: "discover-group",
    optional: true,
    title: "Rows to browse",
    body: "Trending, most liked, most reused, at your region's AOs, newest, and the ones you've liked. Like a workout with the heart, or open it and Reuse it to make it your own.",
  },
  {
    route: "/library",
    target: "exicon-search",
    title: "The Exicon",
    body: "Exercises and routines from F3's and FiA's Exicons and your region's own. Search by name or description.",
  },
  {
    route: "/library",
    target: "source-chips",
    title: "Narrow it down",
    body: "Choose the sources and tags, open an entry to read it, and copy it. While writing a workout, the Exicon button adds an entry straight in.",
  },
  {
    route: "/pax",
    target: "pax-search",
    title: "PAX",
    body: "Everyone on your region's roster. Naming an FNG? Search here first to see whether the name's already taken.",
  },
  {
    route: "/pax",
    target: "pax-filters",
    optional: true,
    title: "Regions and Rocket",
    body: "Choose which regions to list, and tick Only PAX on Rocket to see who's signed up.",
  },
  {
    route: "/pax",
    target: "pax-tile",
    before: () => window.dispatchEvent(new Event(TOUR_SHOW_PAX_EVENT)),
    optional: true,
    title: "Each PAX",
    body: "Their regions, posts and Qs, and the likes and reuses their workouts have had. Tap one for their profile.",
  },
  {
    target: "profile-header",
    before: click('[data-tour="pax-tile"]'),
    optional: true,
    title: "A PAX's profile",
    body: "Whether they're on Rocket yet, top right.",
  },
  {
    target: "profile-stats",
    optional: true,
    title: "Their stats",
    body: "Posts, Qs, likes and reuses, and their posts and Qs in each region.",
  },
  {
    target: "profile-section",
    optional: true,
    title: "Their workouts and backblasts",
    body: "What's trending, and every public workout and backblast they've written.",
  },
  {
    route: "/",
    target: "menu",
    title: "That's the tour",
    body: "Everything's in the menu. Once a workout of yours has happened, Rocket shows you how to write its backblast. See the tour again any time from Settings → Tutorial.",
  },
];

const BACKBLAST: Step[] = [
  {
    route: "/",
    target: "needs-backblast",
    title: "Time for a backblast",
    body: "This workout has happened, so it's ready for its backblast. Let's write it.",
  },
  {
    target: "create-backblast",
    before: () => find("needs-backblast")?.closest<HTMLElement>("a")?.click(),
    title: "Create backblast",
    body: "On the workout's page, Create backblast starts one with the workout's sections already in it.",
  },
  {
    target: "editor-steps",
    before: click('[data-tour="create-backblast"]'),
    title: "A backblast, page by page",
    body: "Workout (copied in, so you can change what you actually did), Notes, Name-o-rama, Announcements, Coffeeteria, then Review.",
  },
  {
    target: "editor-page",
    before: click('[aria-label="Go to Name-o-rama"]'),
    title: "Name-o-rama",
    body: "The Q and every PAX who posted, with suggestions from your region's roster and the AO's regulars; the count adds up as you go. Naming an FNG? Check the PAX page for names already taken.",
  },
  {
    target: "editor-save",
    before: click('[data-tour="editor-skip"]'),
    title: "Finish and share",
    body: "Check it over and tap Done. Then Copy or Share it to Band or Slack from its page.",
  },
];

const TOURS: Record<TourName, Step[]> = { main: MAIN, backblast: BACKBLAST };
const DONE_KEY: Record<TourName, string> = {
  main: "tutorial_done",
  backblast: "tutorial_backblast_done",
};

/** How long to wait for a step's target after a page opens (pages load their data first). */
const WAIT_MS = 4000;
/** How long to look on a page that's already loaded before leaving an optional step out. */
const SETTLED_MS = 700;
const PAD = 6;

export function AppTour() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [tour, setTour] = useState<TourName | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [ready, setReady] = useState(false);
  // Steps left out because what they point to isn't on screen, so the count has no gaps.
  const [skipped, setSkipped] = useState<number[]>([]);
  const direction = useRef<1 | -1>(1);
  // When the current page opened, so targets get time to load on a new page but not after.
  const arrived = useRef({ path: "", at: 0 });
  const offered = useRef(false);
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const steps = tour ? TOURS[tour] : [];
  const step = steps[index];

  /** Shows another step: hidden until its page is there and its target found. */
  const moveTo = useCallback((next: number) => {
    setReady(false);
    setRect(null);
    setIndex(next);
  }, []);

  /**
   * Starts a tour, once the example workout and backblast are there for it to show (added if
   * missing, never twice).
   */
  const begin = useCallback(
    async (name: TourName) => {
      const current = userRef.current;
      if (current) await ensureExamples(current);
      direction.current = 1;
      setSkipped([]);
      moveTo(0);
      setTour(name);
    },
    [moveTo],
  );

  const finish = useCallback(() => {
    if (tour)
      createClient()
        .auth.updateUser({ data: { [DONE_KEY[tour]]: true } })
        .then(() => {});
    setTour(null);
    setRect(null);
  }, [tour]);

  // Settings → Tutorial.
  useEffect(() => {
    const start = (event: Event) =>
      void begin((event as CustomEvent<TourName>).detail);
    window.addEventListener(TOUR_EVENT, start);
    return () => window.removeEventListener(TOUR_EVENT, start);
  }, [begin]);

  // The main tour, once per account, after this device's setup is out of the way.
  useEffect(() => {
    // Only from Home, so opening a shared link isn't interrupted.
    if (!user || user.needsProfile || user.tutorialDone || tour) return;
    if (pathname !== "/") return;
    const offer = () => {
      if (offered.current || !deviceSetupFinished()) return;
      offered.current = true;
      void begin("main");
    };
    const timer = setTimeout(offer, 2500);
    window.addEventListener(DEVICE_SETUP_DONE_EVENT, offer);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(DEVICE_SETUP_DONE_EVENT, offer);
    };
  }, [user, tour, begin, pathname]);

  // The backblast tour, the first time Home shows a workout that needs its backblast.
  useEffect(() => {
    if (
      !user ||
      !user.tutorialDone ||
      user.tutorialBackblastDone ||
      tour ||
      offered.current ||
      pathname !== "/"
    )
      return;
    const timer = setTimeout(() => {
      if (!find("needs-backblast") || offered.current || !deviceSetupFinished())
        return;
      offered.current = true;
      void begin("backblast");
    }, 3000);
    return () => clearTimeout(timer);
  }, [user, tour, pathname, begin]);

  // Go to the step's page, run its action, then find what it spotlights.
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    const here = (pathname.replace(/\/$/, "") || "/") === step.route;
    if (step.route && !here) {
      router.push(step.route);
      return;
    }
    if (arrived.current.path !== pathname)
      arrived.current = { path: pathname, at: Date.now() };
    const deadline = Math.max(
      arrived.current.at + WAIT_MS,
      Date.now() + SETTLED_MS,
    );
    const look = () => {
      if (cancelled) return;
      if (!step.target) return setReady(true);
      const el = find(step.target);
      if (el && el.getBoundingClientRect().height > 0) {
        setSkipped((list) => list.filter((i) => i !== index));
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        setReady(true);
        return;
      }
      if (Date.now() < deadline) return void setTimeout(look, 150);
      // Not on this page: leave optional steps out, and show the others without a spotlight.
      if (step.optional) {
        setSkipped((list) => (list.includes(index) ? list : [...list, index]));
        const next = index + direction.current;
        if (next < 0 || next >= steps.length) finish();
        else moveTo(next);
      } else setReady(true);
    };
    // Run the step's action, then let it (and any page change it makes) happen first.
    step.before?.();
    const timer = setTimeout(look, step.before ? 400 : 50);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step, index, pathname, router, steps.length, finish, moveTo]);

  // Keep the spotlight on its target as the page scrolls or settles.
  useEffect(() => {
    if (!ready || !step?.target) return;
    const measure = () => {
      const el = find(step.target!);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const timer = setInterval(measure, 150);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", measure);
    };
  }, [ready, step]);

  if (!tour || !step || !ready) return null;

  const go = (by: 1 | -1) => {
    direction.current = by;
    const next = index + by;
    if (next >= steps.length) return finish();
    if (next >= 0) moveTo(next);
  };
  // The card sits on the half of the screen away from what's spotlighted.
  const cardAtTop =
    rect !== null &&
    rect.top + rect.height / 2 >
      (typeof window === "undefined" ? 0 : window.innerHeight / 2);

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-2xl border-2 border-accent transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.62)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/60" />
      )}
      <div
        className={`fixed inset-x-3 mx-auto flex max-w-md flex-col gap-3 rounded-3xl border border-line-strong bg-surface-raised p-5 shadow-2xl ${
          rect === null
            ? "top-1/2 -translate-y-1/2"
            : cardAtTop
              ? "top-4"
              : "bottom-4"
        }`}
      >
        <span className="font-mono text-xs text-muted">
          {tour === "main" ? "Tour" : "Your first backblast"} ·{" "}
          {index + 1 - skipped.filter((i) => i < index).length} of{" "}
          {steps.length - skipped.length}
        </span>
        <h2 id="tour-title" className="text-lg font-semibold text-ink">
          {step.title}
        </h2>
        <p className="text-sm text-ink-soft">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={finish} className="link text-sm">
            Skip tour
          </button>
          <span className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => go(-1)}
                className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft transition hover:border-line-strong"
              >
                Back
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => go(1)}
              className="rounded-full border border-accent/60 bg-accent-soft px-5 py-1.5 text-sm font-medium text-ink transition hover:border-accent"
            >
              {index === steps.length - 1 ? "Done" : "Next"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
