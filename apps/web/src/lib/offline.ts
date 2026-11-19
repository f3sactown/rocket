"use client";

/**
 * Keeps copies for offline use (at an AO with no signal): opens screens out of sight, in a hidden
 * frame, so the service worker keeps their pages and the data they load. They're opened just as
 * you would open them, so the copies are exactly what those screens ask for.
 *
 * Screens wait in a queue, one opened at a time:
 * - first, what you've just left (a workout's page brings its Run workout screen, and the other
 *   way round) and what you've changed (a workout or backblast saved since);
 * - then the rest (Home's list: the main screens, your recent and upcoming workouts, your recent
 *   backblasts), only once you've stopped moving around Rocket for a few seconds.
 * A screen kept in the last 3 hours isn't kept again, unless it's changed since.
 */

import { addDays } from "../../../../supabase/functions/_shared/reminders";
import { localToday } from "./backblast-list";
import { refreshPocketSoon } from "./pocket";
import { createClient } from "./supabase/client";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/** When each screen was last kept, by its address. */
const KEPT_KEY = "rocket-offline-kept-at";
/**
 * What's waiting to be kept first, and what's changed, kept on the phone too: closing Rocket (or
 * reloading it) before they're kept picks them up next time it opens.
 */
const QUEUE_KEY = "rocket-offline-queue";
/** How often the same screen is fetched again, to keep its copy fresh. */
const EVERY_MS = 3 * 60 * 60 * 1000;
/** How long to give each screen to load its data. */
const SETTLE_MS = 4000;
/** The most a screen is given before going on to the next. */
const MOST_MS = 15000;
/** How long after moving to another screen the rest wait, so they don't slow it down. */
const IDLE_MS = 4000;

/** The main screens that work offline (the others need a connection), kept whatever's on Home. */
export const MAIN_SCREENS = [
  "/workouts/",
  "/backblasts/",
  // Writing one offline: the forms, with their templates, AOs and the workouts to choose from.
  "/workouts/new/",
  "/backblasts/new/",
  // The Exicon, kept whole for its screen and the forms' Exicon buttons.
  "/exicon/",
];

/** Writing a workout's backblast (its copy of the workout, the roster and regulars), offline too. */
export const backblastForScreen = (workoutId: string) =>
  `/backblasts/new/?workout=${workoutId}`;

/** A workout's page and its Run workout screen. */
export const workoutScreens = (id: string) => [
  `/workout/?id=${id}`,
  `/workout/run/?id=${id}`,
];

/** A backblast's page. */
export const backblastScreens = (id: string) => [`/backblast/?id=${id}`];

/** The screens to keep for an address you're leaving: its own, with its pair. */
export function screensFor(path: string, search: string): string[] {
  const page = path.replace(/\/$/, "") || "/";
  const id = new URLSearchParams(search).get("id");
  if (id && (page === "/workout" || page === "/workout/run"))
    return workoutScreens(id);
  if (id && page === "/workouts/edit") return workoutScreens(id);
  if (id && (page === "/backblast" || page === "/backblasts/edit"))
    return backblastScreens(id);
  if (["/workouts", "/backblasts"].includes(page)) return [`${page}/`];
  return [];
}

interface Item {
  path: string;
  /** Kept again even if it was recently (it's changed since). */
  force: boolean;
}

/** First in line: what you've left or changed. */
const soon: Item[] = [];
/** The rest, when you're not moving around. */
const later: Item[] = [];
/** Workouts and backblasts saved since you came to this screen: kept once you leave it. */
const changed = new Set<string>();
/** When you last moved to another screen (or opened Rocket). */
let lastMove = typeof window === "undefined" ? 0 : Date.now();
let pumping = false;
let restored = false;

function save() {
  try {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify({ soon, changed: [...changed] }),
    );
  } catch {
    // Not kept for next time.
  }
}

/** Picks up what was waiting when Rocket was last closed. */
function restore() {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const saved = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "null") as {
      soon?: Item[];
      changed?: string[];
    } | null;
    for (const item of saved?.soon ?? [])
      if (!soon.some((s) => s.path === item.path)) soon.push(item);
    // Changed last time and never left: kept now.
    for (const path of saved?.changed ?? [])
      soon.unshift({ path, force: true });
  } catch {
    // Nothing to pick up.
  }
}

function keptAt(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEPT_KEY) ?? "{}") as Record<
      string,
      number
    >;
  } catch {
    return {};
  }
}

function markKept(path: string) {
  try {
    const all = keptAt();
    all[path] = Date.now();
    // Only the recent ones, so the list doesn't grow for ever.
    for (const [key, at] of Object.entries(all))
      if (Date.now() - at > EVERY_MS) delete all[key];
    localStorage.setItem(KEPT_KEY, JSON.stringify(all));
  } catch {
    // Kept again next time.
  }
}

const recentlyKept = (path: string) =>
  Date.now() - (keptAt()[path] ?? 0) < EVERY_MS;

function add(list: Item[], paths: string[], force: boolean, front: boolean) {
  restore();
  for (const path of paths) {
    // Already first in line: it stays there (Home's list never moves it back).
    if (list === later && soon.some((item) => item.path === path)) continue;
    // Already waiting: move it up (and keep it forced if either asks).
    for (const queue of [soon, later]) {
      const at = queue.findIndex((item) => item.path === path);
      if (at >= 0) {
        force = force || queue[at]!.force;
        queue.splice(at, 1);
      }
    }
    if (front) list.unshift({ path, force });
    else list.push({ path, force });
  }
  save();
  void pump();
}

/** Keeps these screens next, before anything else waiting. */
export function keepSoon(paths: string[], force = false) {
  add(soon, paths, force, true);
}

/** Keeps these screens when you're not moving around Rocket (Home's list). */
export function keepLater(paths: string[]) {
  add(later, paths, false, false);
}

/** A workout or backblast was saved: its screens are kept again once you leave this one. */
export function markChanged(paths: string[]) {
  for (const path of paths) changed.add(path);
  save();
  // Your recent workouts and backblasts on the phone are fetched again too.
  refreshPocketSoon();
}

/** Starts on whatever was waiting when Rocket was last closed. */
export function resumeKeeping() {
  restore();
  void pump();
}

/**
 * You've moved from one screen to another: the one you left is kept first (it's just been
 * loaded, so its pair is what's fetched), with anything changed there; the rest wait a little.
 */
export function leftScreen(path: string, search: string) {
  lastMove = Date.now();
  const left = screensFor(path, search);
  // The screen you were on was just loaded, so its copy is fresh.
  const page = path.replace(/\/$/, "");
  const query = search.replace(/^\?/, "");
  const here = `${page}/${query ? `?${query}` : ""}`;
  for (const screen of left) if (screen === here) markKept(screen);
  restore();
  const edits = [...changed];
  changed.clear();
  // Lists showing a changed workout or backblast are kept again too.
  if (edits.some((p) => p.startsWith("/workout"))) edits.push("/workouts/");
  if (edits.some((p) => p.startsWith("/backblast"))) edits.push("/backblasts/");
  keepSoon(left);
  if (edits.length) keepSoon(edits, true);
}

/** Whether keeping copies can happen: on a connection, not in Data Saver, not inside a frame. */
async function ready(): Promise<boolean> {
  if (typeof window === "undefined" || window.top !== window) return false;
  if (!navigator.onLine || !("serviceWorker" in navigator)) return false;
  const connection = (navigator as { connection?: { saveData?: boolean } })
    .connection;
  if (connection?.saveData) return false;
  // The first time Rocket opens on a device, its service worker takes over a moment later.
  if (!navigator.serviceWorker.controller)
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => resolve(),
        { once: true },
      );
      setTimeout(resolve, 30000);
    });
  return !!navigator.serviceWorker.controller;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Opens the waiting screens one at a time in a hidden frame. */
async function pump() {
  if (pumping) return;
  pumping = true;
  let frame: HTMLIFrameElement | null = null;
  try {
    if (!(await ready())) return;
    for (;;) {
      let item = soon.shift();
      if (!item) {
        if (!later.length) break;
        // The rest only once you've stayed put for a few seconds.
        const wait = lastMove + IDLE_MS - Date.now();
        if (wait > 0) {
          await sleep(wait);
          continue;
        }
        item = later.shift()!;
      }
      if (!item.force && recentlyKept(item.path)) {
        save();
        continue;
      }
      if (!navigator.onLine) {
        // Back in line for when the connection returns.
        soon.unshift(item);
        break;
      }
      frame ??= makeFrame();
      await open(frame, item.path);
      markKept(item.path);
      save();
    }
  } finally {
    frame?.remove();
    pumping = false;
  }
}

function makeFrame(): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:400px;height:800px;opacity:0;pointer-events:none;border:0";
  document.body.appendChild(frame);
  return frame;
}

function open(frame: HTMLIFrameElement, path: string) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(most);
      frame.removeEventListener("load", loaded);
      resolve();
    };
    const loaded = () => setTimeout(done, SETTLE_MS);
    const most = setTimeout(done, MOST_MS);
    frame.addEventListener("load", loaded);
    frame.src = `${BASE}${path}`;
  });
}

/**
 * Your finished workouts worth having offline: every one from the last two weeks and all those
 * coming up (the most recent 20), newest first.
 */
export async function offlineWorkoutIds(
  userId: string,
): Promise<{ id: string; date: string | null }[]> {
  const { data } = await createClient()
    .from("workouts")
    .select("id, date")
    .eq("author_id", userId)
    .eq("status", "published")
    .gte("date", addDays(localToday(), -14))
    .order("date", { ascending: false, nullsFirst: false })
    .limit(20);
  return data ?? [];
}
