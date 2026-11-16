"use client";

/**
 * Keeps copies for offline use (at an AO with no signal): opens Rocket's main screens and your
 * recent and upcoming workouts, with their Run workout screens, out of sight, so the service
 * worker keeps their pages and the data they load. They're opened just as you would open them,
 * so the copies are exactly what those screens ask for.
 */

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const KEY = "rocket-offline-kept";
/** How often the same screens are fetched again, to keep their copies fresh. */
const EVERY_MS = 3 * 60 * 60 * 1000;
/** How long to give each screen to load its data. */
const SETTLE_MS = 4000;
/** The most a screen is given before going on to the next. */
const MOST_MS = 15000;

/** The main screens, kept whatever's on Home. */
export const MAIN_SCREENS = [
  "/workouts/",
  "/backblasts/",
  "/discover/",
  "/library/",
  "/pax/",
  "/settings/",
];

/** A workout's page and its Run workout screen. */
export const workoutScreens = (id: string) => [
  `/workout/?id=${id}`,
  `/workout/run/?id=${id}`,
];

let running = false;

/**
 * Opens each screen in turn in a hidden frame, unless the same ones were kept recently. Only on a
 * connection, not in Data Saver, and never from inside one of those frames.
 */
export function keepForOffline(paths: string[]) {
  if (running || typeof window === "undefined") return;
  if (window.top !== window || !navigator.onLine) return;
  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller)
    return;
  const connection = (navigator as { connection?: { saveData?: boolean } })
    .connection;
  if (connection?.saveData) return;
  const list = [...new Set(paths)];
  const signature = list.join("|");
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? "null") as {
      signature: string;
      at: number;
    } | null;
    if (kept?.signature === signature && Date.now() - kept.at < EVERY_MS)
      return;
  } catch {
    // Kept again.
  }
  running = true;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:400px;height:800px;opacity:0;pointer-events:none;border:0";
  document.body.appendChild(frame);

  const open = (path: string) =>
    new Promise<void>((resolve) => {
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

  (async () => {
    for (const path of list) {
      if (!navigator.onLine) break;
      await open(path);
    }
    frame.remove();
    running = false;
    try {
      localStorage.setItem(KEY, JSON.stringify({ signature, at: Date.now() }));
    } catch {
      // Kept again next time.
    }
  })();
}
