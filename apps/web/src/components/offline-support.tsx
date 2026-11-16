"use client";

import { useEffect, useSyncExternalStore } from "react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Lets Rocket work without a signal: registers the service worker that keeps the app's pages and
 * the data you've looked at, and says so when the phone is offline.
 */
export function OfflineSupport() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(`${BASE}/sw.js`, { scope: `${BASE}/` })
      .catch(() => {
        // Without it Rocket still works, just not offline.
      });
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-2xl border border-line-strong bg-panel px-4 py-2.5 text-sm text-ink-soft"
    >
      <span className="size-2 shrink-0 rounded-full bg-muted" aria-hidden />
      <span>
        <strong className="text-ink">Offline.</strong> You can keep going: the
        main screens, your recent and upcoming workouts (and running them), and
        anything you&apos;ve opened before still show. What you type is kept on
        this phone and saved once you&apos;re back online.
      </span>
    </div>
  );
}
