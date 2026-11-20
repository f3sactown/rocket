"use client";

import { inTermsOf } from "@rocket/core";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-provider";
import { DEVICE_SETUP_DONE_EVENT, deviceSetupFinished } from "./device-setup";

/**
 * The app tour: a step-by-step walk through Rocket that spotlights one part of a page at a time,
 * moving between pages as it goes. Along the way the user writes a workout, page by page, taps
 * Done, then writes that workout's backblast. It runs once per account (after the device setup);
 * Settings → Tutorial runs it again.
 */

interface Step {
  /** The page the step is on (the tour goes there first); none to stay where the last step left. */
  route?: string;
  /** Added to the route when the tour opens it. */
  query?: string;
  /** Other pages that count as being there (a new workout's address changes once it's saved). */
  alsoAt?: string[];
  /** The `data-tour` name of what to spotlight; none for a card in the middle of the screen. */
  target?: string;
  title: string;
  body: string;
  /** Run before looking for the target, e.g. to open a page of the workout form. */
  before?: () => void;
  /** Leave the step out when its target isn't on the page (e.g. a Home section that's hidden). */
  optional?: boolean;
  /** With `optional`: when its target isn't there, leave out the steps of this group after it too. */
  group?: string;
  /** The user fills in what's spotlighted: the page stays usable around the tour's card. */
  interactive?: boolean;
  /** The step ends when this page opens (the user taps Done), not with Next. */
  until?: string;
  /** No Back from here (the step before it can't be returned to, e.g. a finished form). */
  noBack?: boolean;
}

const TOUR_EVENT = "rocket-tour";
/** Asks the PAX page to show tiles down to the PAX the tour opens (it may be far down the list). */
export const TOUR_SHOW_PAX_EVENT = "rocket-tour-show-pax";

/** Starts the tour now (from Settings). */
export function startTour() {
  window.dispatchEvent(new Event(TOUR_EVENT));
}

/** Whether the tour is running (notices wait, so they don't cover it). */
export function tourRunning(): boolean {
  return document.documentElement.dataset.tour === "on";
}

const find = (target: string) =>
  document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
const click = (selector: string) => () =>
  document.querySelector<HTMLElement>(selector)?.click();
/** Opens a page of the workout or backblast form. */
const openPage = (name: string) => click(`[data-step="${name}"]`);

/** The page a path is, without a trailing slash. */
const pageOf = (path: string) => path.replace(/\/$/, "") || "/";

const STEPS: Step[] = [
  {
    route: "/",
    title: "Welcome to Rocket",
    body: "A walk through Rocket. You'll write a workout, page by page, then its backblast, and see Discover, the Exicon and PAX. Skip it any time.",
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
    title: "Write a workout",
    body: "New workout starts one. Let's write one together: tap Next.",
  },
  {
    route: "/workouts/new",
    query: "?tour=1",
    alsoAt: ["/workouts/edit"],
    target: "editor-steps",
    title: "A workout, page by page",
    body: "Basics, Introduction, Warm-o-rama, The Thang, Notes, Words of Wisdom, then Review. It saves as you type. The tour opens each page for you.",
  },
  {
    target: "editor-page",
    before: openPage("basics"),
    interactive: true,
    title: "Basics",
    body: "Give it a title and choose the AO (that fills in the address and time). It's dated today, so you can write its backblast next. Then tap Next.",
  },
  {
    target: "editor-page",
    before: openPage("introduction"),
    interactive: true,
    title: "Introduction",
    body: "What you say to open. Templates loads the standard one; star a template to fill it in on every new workout. Then tap Next.",
  },
  {
    target: "editor-page",
    before: openPage("warmup"),
    interactive: true,
    title: "Warm-up",
    body: "The warm-up exercises. The Exicon button adds them from F3's and FiA's lists. Then tap Next.",
  },
  {
    target: "editor-page",
    before: openPage("thang"),
    interactive: true,
    title: "The Thang",
    body: "The workout itself. Add each thang, with a timer if you like (Countdown, Stopwatch, AMRAP, Tabata or EMOM), a song, and exercises from the Exicon. Then tap Next.",
  },
  {
    target: "editor-page",
    before: openPage("notes"),
    interactive: true,
    title: "Notes",
    body: "Notes for you as the Q only. They're never shown to anyone or copied. Then tap Next.",
  },
  {
    target: "editor-page",
    before: openPage("wordsOfWisdom"),
    interactive: true,
    title: "Words of wisdom",
    body: "Something to leave the PAX with. Then tap Next.",
  },
  {
    target: "editor-save",
    before: openPage("review"),
    interactive: true,
    until: "/workout",
    title: "Review and Done",
    body: "Check it over (tap a section to change it), then tap Done to finish it.",
  },
  {
    target: "workout-share",
    noBack: true,
    title: "Your workout",
    body: "Run workout takes you through it at the AO, with its timers and music. Copy or Share it to Band or Slack, and choose who sees it with Public / Private.",
  },
  {
    target: "backblast-not-yet",
    optional: true,
    title: "Its backblast",
    body: "This workout is after today, so its backblast comes once it has happened: tap Create backblast here then. On with the tour.",
  },
  {
    target: "create-backblast",
    optional: true,
    group: "backblast",
    title: "Write its backblast",
    body: "After the workout, Create backblast starts its backblast with the workout copied in. Let's write it: tap Next.",
  },
  {
    target: "editor-steps",
    group: "backblast",
    before: click('[data-tour="create-backblast"]'),
    noBack: true,
    title: "A backblast, page by page",
    body: "Workout, Notes, Name-o-rama, Announcements, Coffeeteria, then Review. It saves as you type, too.",
  },
  {
    target: "editor-page",
    group: "backblast",
    before: openPage("workout"),
    interactive: true,
    title: "The workout",
    body: "Copied from your workout. Tap Edit to change anything that went differently; Rocket asks at the end whether to update the workout too. Then tap Next.",
  },
  {
    target: "editor-page",
    group: "backblast",
    before: openPage("notes"),
    interactive: true,
    title: "Notes",
    body: "Anything else about how it went. Then tap Next.",
  },
  {
    target: "editor-page",
    group: "backblast",
    before: openPage("attendance"),
    interactive: true,
    title: "Name-o-rama",
    body: "The Q and every PAX who posted, with suggestions from your region's roster and the AO's regulars. Mark FNGs with who invited them. Naming an FNG? The PAX page shows names already taken. Then tap Next.",
  },
  {
    target: "editor-page",
    group: "backblast",
    before: openPage("announcements"),
    interactive: true,
    title: "Announcements",
    body: "Anything beyond the site Q's usual announcements. Optional. Then tap Next.",
  },
  {
    target: "editor-page",
    group: "backblast",
    before: openPage("secondF"),
    interactive: true,
    title: "Coffeeteria",
    body: "Where the PAX went after, usually coffee. Then tap Next.",
  },
  {
    target: "editor-save",
    group: "backblast",
    before: openPage("review"),
    interactive: true,
    until: "/backblast",
    title: "Review and Done",
    body: "Check it over, then tap Done to finish it.",
  },
  {
    target: "backblast-share",
    group: "backblast",
    noBack: true,
    title: "Share it",
    body: "Copy or Share the backblast to Band or Slack. Edit changes it later.",
  },
  {
    route: "/discover",
    target: "source-chips",
    noBack: true,
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
    route: "/exicon",
    target: "exicon-search",
    title: "The Exicon",
    body: "Exercises and routines from F3's and FiA's Exicons and your region's own. Search by name or description.",
  },
  {
    route: "/exicon",
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
    body: "Everything's in the menu. See the tour again any time from Settings → Tutorial.",
  },
];

/** How long to wait for a step's target after a page opens (pages load their data first). */
const WAIT_MS = 4000;
/** How long to look on a page that's already loaded before leaving an optional step out. */
const SETTLED_MS = 700;
const PAD = 6;

export function AppTour() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [ready, setReady] = useState(false);
  // Steps left out because what they point to isn't on screen, so the count has no gaps.
  const [skipped, setSkipped] = useState<number[]>([]);
  const direction = useRef<1 | -1>(1);
  // When the current page opened, so targets get time to load on a new page but not after.
  const arrived = useRef({ path: "", at: 0 });
  const offered = useRef(false);

  const steps = STEPS;
  const step = running ? steps[index] : undefined;

  /** Shows another step: hidden until its page is there and its target found. */
  const moveTo = useCallback((next: number) => {
    setReady(false);
    setRect(null);
    setIndex(next);
  }, []);

  const begin = useCallback(() => {
    direction.current = 1;
    setSkipped([]);
    moveTo(0);
    setRunning(true);
  }, [moveTo]);

  const finish = useCallback(() => {
    if (running)
      createClient()
        .auth.updateUser({ data: { tutorial_done: true } })
        .then(() => {});
    setRunning(false);
    setRect(null);
  }, [running]);

  // Let the rest of the app know, so its notices wait.
  useEffect(() => {
    document.documentElement.dataset.tour = running ? "on" : "off";
  }, [running]);

  // Settings → Tutorial.
  useEffect(() => {
    window.addEventListener(TOUR_EVENT, begin);
    return () => window.removeEventListener(TOUR_EVENT, begin);
  }, [begin]);

  // Once per account, after this device's setup is out of the way.
  useEffect(() => {
    // Only from Home, so opening a shared link isn't interrupted.
    if (!user || user.needsProfile || user.tutorialDone || running) return;
    if (pathname !== "/") return;
    const offer = () => {
      if (offered.current || !deviceSetupFinished()) return;
      offered.current = true;
      begin();
    };
    const timer = setTimeout(offer, 2500);
    window.addEventListener(DEVICE_SETUP_DONE_EVENT, offer);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(DEVICE_SETUP_DONE_EVENT, offer);
    };
  }, [user, running, begin, pathname]);

  // Go to the step's page, run its action, then find what it spotlights.
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    const page = pageOf(pathname);
    // The user tapped Done and the finished page opened: on to the next step.
    if (step.until && page === step.until) {
      const timer = setTimeout(() => {
        direction.current = 1;
        if (index + 1 >= steps.length) finish();
        else moveTo(index + 1);
      }, 0);
      return () => clearTimeout(timer);
    }
    if (step.route && page !== step.route && !step.alsoAt?.includes(page)) {
      router.push(step.route + (step.query ?? ""));
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
        if (step.interactive) {
          // Its top in view, below the bar pinned to the top while a form is scrolled.
          const top = el.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: Math.max(0, top) });
        } else el.scrollIntoView({ block: "center", behavior: "smooth" });
        setReady(true);
        return;
      }
      if (Date.now() < deadline) return void setTimeout(look, 150);
      // Not on this page: leave optional steps out, and show the others without a spotlight.
      if (step.optional) {
        // A group's first step missing means the whole group is: leave the rest out too.
        let next = index + direction.current;
        const gone = [index];
        if (step.group && direction.current === 1)
          while (steps[next]?.group === step.group) gone.push(next++);
        setSkipped((list) => [...new Set([...list, ...gone])]);
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
  }, [step, index, pathname, router, steps, finish, moveTo]);

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

  if (!running || !step || !ready) return null;

  const go = (by: 1 | -1) => {
    direction.current = by;
    const next = index + by;
    if (next >= steps.length) return finish();
    if (next >= 0) moveTo(next);
  };
  const interactive = step.interactive === true;
  // Another dialog over the page (asking whether to update the workout, say): out of its way.
  const otherDialog =
    interactive &&
    document.querySelector(
      '[role="dialog"][aria-modal="true"]:not([data-app-tour])',
    );
  if (otherDialog) return null;
  // The card sits on the half of the screen away from what's spotlighted; while filling in a
  // page, at the bottom, out of the way of the page's top.
  const cardAtTop =
    !interactive &&
    rect !== null &&
    rect.top + rect.height / 2 > window.innerHeight / 2;
  const canGoBack =
    index > 0 &&
    !step.noBack &&
    steps.slice(0, index).some((_, i) => !skipped.includes(i));

  return (
    <div
      data-app-tour
      className={`fixed inset-0 z-[60] ${interactive ? "pointer-events-none" : ""}`}
      role="dialog"
      // While filling in a page, the page stays usable around the card.
      aria-modal={!interactive}
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
            boxShadow: `0 0 0 9999px rgba(0, 0, 0, ${interactive ? 0.4 : 0.62})`,
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/60" />
      )}
      <div
        className={`pointer-events-auto fixed inset-x-3 mx-auto flex max-w-md flex-col rounded-3xl border border-line-strong bg-surface-raised shadow-2xl ${
          interactive ? "gap-2 p-4" : "gap-3 p-5"
        } ${
          rect === null
            ? "top-1/2 -translate-y-1/2"
            : cardAtTop
              ? "top-4"
              : "bottom-4"
        }`}
      >
        <span className="font-mono text-xs text-muted">
          Tour · {index + 1 - skipped.filter((i) => i < index).length} of{" "}
          {steps.length - skipped.length}
        </span>
        <h2
          id="tour-title"
          className={`font-semibold text-ink ${interactive ? "text-base" : "text-lg"}`}
        >
          {step.title}
        </h2>
        <p className="text-sm text-ink-soft">
          {inTermsOf(step.body, user?.language)}
        </p>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={finish} className="link text-sm">
            Skip tour
          </button>
          <span className="flex gap-2">
            {canGoBack && (
              <button
                type="button"
                onClick={() => go(-1)}
                className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft transition hover:border-line-strong"
              >
                Back
              </button>
            )}
            {!step.until && (
              <button
                type="button"
                // Not while filling in a page: the cursor stays in its field.
                autoFocus={!interactive}
                onClick={() => go(1)}
                className="rounded-full border border-accent/60 bg-accent-soft px-5 py-1.5 text-sm font-medium text-ink transition hover:border-accent"
              >
                {index === steps.length - 1 ? "Done" : "Next"}
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
