// Rocket's service worker:
// - keeps copies of the app's pages and code, so Rocket opens with no signal (at an AO, say);
// - keeps copies of the data you've looked at, so a workout you've opened before can be read and
//   run offline (always fetched fresh when there's a connection; the copy is only a fallback);
// - shows push notifications and opens the right page when one is tapped.

const PAGES_CACHE = "rocket-pages-v1";
const DATA_CACHE = "rocket-data-v1";
/** How long to wait on a slow connection before using the kept copy instead. */
const SLOW_MS = 5000;

/** The app's pages, kept when it's installed so they open offline even if never visited. */
const PAGES = [
  "",
  "workouts/",
  "workouts/new/",
  "workouts/edit/",
  "workout/",
  "workout/run/",
  "backblasts/",
  "backblasts/new/",
  "backblasts/edit/",
  "backblast/",
  "discover/",
  "library/",
  "pax/",
  "pax/profile/",
  "settings/",
  "about/",
];

/** Keeps each page and the code it loads (the /_next/static/ files it names). */
async function keepPages() {
  const cache = await caches.open(PAGES_CACHE);
  const scope = self.registration.scope;
  const assets = new Set();
  await Promise.allSettled(
    PAGES.map(async (page) => {
      const url = new URL(page, scope).href;
      const response = await fetch(url, { cache: "no-cache" });
      if (!response.ok) return;
      await cache.put(url, response.clone());
      const html = await response.text();
      for (const match of html.matchAll(
        /["'(]([^"'()\s]*\/_next\/static\/[^"'()\s]+)["')]/g,
      ))
        assets.add(new URL(match[1], url).href);
    }),
  );
  await Promise.allSettled(
    [...assets].map(async (url) => {
      if (await cache.match(url)) return;
      const response = await fetch(url);
      if (response.ok) await cache.put(url, response);
    }),
  );
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(keepPages().catch(() => {}));
});

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const keep = [PAGES_CACHE, DATA_CACHE];
      for (const name of await caches.keys())
        if (!keep.includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);

/**
 * The kept copy of a request. A page asked for without its trailing slash (/workout?id=… rather
 * than /workout/?id=…, which the site redirects to) is kept under the address with the slash.
 */
async function keptCopy(cache, request, match) {
  const kept = await cache.match(request, match);
  if (kept) return kept;
  // Data asked for with another day's date: the latest answer kept, whatever its day.
  const key = undated(request);
  if (key) {
    const latest = await cache.match(key);
    if (latest) return latest;
  }
  const url = new URL(request.url);
  const last = url.pathname.split("/").pop();
  if (url.origin !== self.location.origin || !last || last.includes("."))
    return undefined;
  url.pathname += "/";
  return cache.match(url.href, match);
}

/** How long a request with no kept copy waits for the network before giving up (not pages). */
const GIVE_UP_MS = 15000;
/** How long a request waits before the app says it's checking the connection. */
const CHECKING_MS = 1500;
/**
 * Whether the last request had to use a kept copy (no connection, or too slow). While it does,
 * kept copies answer at once, with a fresh copy fetched alongside; the first request that gets
 * through ends it.
 */
let offline = null; // Unknown until the first request (the worker may have just started).
let nextId = 0;

/**
 * Tells the app's windows how the connection is doing: a request is still waiting ("checking"),
 * or one has settled from the network or a kept copy. The app shows "Checking connection…" and
 * the Offline banner from these.
 */
async function tell(message) {
  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of windows)
    client.postMessage({ type: "rocket-connection", ...message });
}

function wentOnline() {
  if (offline === false) return;
  offline = false;
  tell({ state: "online" });
}

function wentOffline() {
  if (offline === true) return;
  offline = true;
  tell({ state: "offline" });
}

/**
 * Network first: a fresh copy when there's a connection (kept for later), the kept copy when
 * there isn't one or it's too slow. Once offline, the kept copy straight away.
 */
/**
 * Requests that name a date (today's, for "up to today" and "after today") would never match
 * their kept copy on another day. They're also kept under their address with the dates taken out,
 * so offline the latest answer to the same question is found whatever the day.
 */
const DATES = /\d{4}-\d{2}-\d{2}(?:T[0-9:.]+(?:Z|%2B[0-9:]+|\+[0-9:]+)?)?/g;

function undated(request) {
  const url = decodeURIComponent(request.url);
  if (!DATES.test(url)) return null;
  DATES.lastIndex = 0;
  return `${self.location.origin}/__undated__/${encodeURIComponent(url.replace(DATES, "*"))}`;
}

async function networkFirst(event, request, cacheName, match) {
  const cache = await caches.open(cacheName);
  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, response.clone());
      const key = cacheName === DATA_CACHE ? undated(request) : null;
      if (key) await cache.put(key, response.clone());
    }
    // Any answer from the server, even an error page, means the connection is back.
    wentOnline();
    return response;
  });
  // If the kept copy answers first, a later network failure isn't an error.
  network.catch(() => {});
  // Keep the worker running until the network answers too, even after a kept copy has: phones
  // stop it as soon as they can, and it's this answer that says the connection is back.
  event.waitUntil(network.catch(() => {}));

  // Without a kept copy, a page (a navigation) waits for the network; anything else gives up,
  // at once when already offline, so the app can move on (Next.js opens the page in full, from
  // its kept copy; a screen says what isn't kept on this phone).
  const page = request.mode === "navigate";
  if (offline) {
    const kept = await keptCopy(cache, request, match);
    if (kept) return kept;
    if (!page) throw new Error("Offline, and not kept on this phone");
  }

  const id = ++nextId;
  let checking = false;
  const checkingTimer = setTimeout(() => {
    checking = true;
    tell({ state: "checking", id });
  }, CHECKING_MS);
  const settle = () => {
    clearTimeout(checkingTimer);
    if (checking) tell({ state: "settled", id });
  };

  const slow = new Promise((resolve) =>
    setTimeout(() => resolve(undefined), SLOW_MS),
  );
  try {
    const first = await Promise.race([network, slow]);
    if (first) {
      settle();
      return first;
    }
    // Slow: the kept copy if there is one, otherwise keep waiting.
    const kept = await keptCopy(cache, request, match);
    if (kept) {
      wentOffline();
      settle();
      return kept;
    }
    const late = await (page
      ? network
      : Promise.race([
          network,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("No connection")),
              GIVE_UP_MS - SLOW_MS,
            ),
          ),
        ]));
    settle();
    return late;
  } catch (error) {
    wentOffline();
    settle();
    const kept = await keptCopy(cache, request, match);
    if (kept) return kept;
    throw error;
  }
}

/** Cache first, for the app's code, whose file names change whenever it does. */
async function cacheFirst(request) {
  const cache = await caches.open(PAGES_CACHE);
  const kept = await cache.match(request);
  if (kept) return kept;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.includes("/_next/static/"))
      return event.respondWith(cacheFirst(request));
    // Pages (and their data files): one page serves every ?id=, so the query is ignored.
    return event.respondWith(
      networkFirst(event, request, PAGES_CACHE, {
        ignoreSearch: true,
        ignoreVary: true,
      }),
    );
  }
  // Rocket's data from Supabase: workouts, backblasts, profiles and the rest.
  if (url.pathname.includes("/rest/v1/"))
    return event.respondWith(
      networkFirst(event, request, DATA_CACHE, { ignoreVary: true }),
    );
});

// A window asking how the connection is (when it opens).
self.addEventListener("message", (event) => {
  // The app reached the internet itself: back online.
  if (event.data?.type === "rocket-online") wentOnline();
  if (event.data?.type === "rocket-connection?")
    event.source?.postMessage({
      type: "rocket-connection",
      state: offline ? "offline" : offline === false ? "online" : "unknown",
    });
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const scope = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(data.title || "Rocket", {
      body: data.body || "",
      icon: new URL("icons/icon-192.png", scope).href,
      // Android draws the small status-bar icon from its shape alone: a white rocket on clear.
      badge: new URL("icons/badge-96.png", scope).href,
      tag: data.tag,
      data: { url: new URL(data.url || "", scope).href },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Reuse a Rocket window that's already open, if there is one.
      const existing = open.find((c) =>
        c.url.startsWith(self.registration.scope),
      );
      if (existing) {
        await existing.focus();
        return existing.navigate(url);
      }
      return self.clients.openWindow(url);
    })(),
  );
});
