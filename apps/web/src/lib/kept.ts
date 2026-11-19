"use client";

/**
 * The last answer each loader got, kept on this device so its screen still shows it offline (or
 * when the connection drops mid-load): your lists, your region's AOs and roster, the Exicon. It's
 * loaded fresh whenever there's a connection, and the kept copy is only the fallback.
 *
 * Kept in the browser's Cache Storage (room for the whole Exicon), not tied to the exact request
 * the way the service worker's copies are, so a screen that asks a little differently after an
 * update (or on another day) still finds it. Signing out deletes it.
 */

import { isOffline } from "./connection";

export const KEPT_CACHE = "rocket-kept-v1";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const address = (key: string) =>
  `${location.origin}${BASE}/__kept__/${encodeURIComponent(key)}`;

async function store(): Promise<Cache | null> {
  try {
    return typeof caches === "undefined" ? null : await caches.open(KEPT_CACHE);
  } catch {
    return null;
  }
}

/** Keeps a value for next time (plain data only: no Maps or Sets). */
export async function keep(key: string, value: unknown) {
  try {
    const cache = await store();
    await cache?.put(
      address(key),
      new Response(JSON.stringify(value), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch {
    // Not kept; it loads fresh next time.
  }
}

/** The value kept under a key, if there is one. */
export async function readKept<T>(key: string): Promise<T | undefined> {
  try {
    const cache = await store();
    const response = await cache?.match(address(key));
    return response ? ((await response.json()) as T) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Loads fresh and keeps the answer; if loading fails (offline), gives the kept copy instead, and
 * fails only when there's none.
 */
export async function withKeptCopy<T>(
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  // Offline: the kept copy straight away, rather than waiting on a request that can't answer.
  if (isOffline()) {
    const kept = await readKept<T>(key);
    if (kept !== undefined) return kept;
  }
  try {
    const value = await load();
    void keep(key, value);
    return value;
  } catch (error) {
    const kept = await readKept<T>(key);
    if (kept !== undefined) return kept;
    throw error;
  }
}

/** Deletes everything kept (on signing out, so the next person doesn't see it). */
export function dropKept() {
  if (typeof caches !== "undefined") caches.delete(KEPT_CACHE).catch(() => {});
}
