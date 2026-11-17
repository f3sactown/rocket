"use client";

import { useEffect } from "react";
import { useConnection } from "@/lib/connection";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Lets Rocket work without a signal: registers the service worker that keeps the app's pages and
 * the data you've looked at, and says so when it's offline (or still checking the connection).
 */
export function OfflineSupport() {
  const { offline, checking } = useConnection();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(`${BASE}/sw.js`, { scope: `${BASE}/` })
      .catch(() => {
        // Without it Rocket still works, just not offline.
      });
  }, []);

  // A request has been waiting a while: say so, before it gives up and uses a kept copy.
  if (!offline && checking)
    return (
      <div
        role="status"
        // Over the top of the page, so nothing moves when it comes and goes.
        className="fixed top-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line-strong bg-surface-raised/95 px-3 py-1.5 text-xs whitespace-nowrap text-ink-soft shadow-lg backdrop-blur"
      >
        <span
          className="size-2 shrink-0 animate-pulse rounded-full bg-accent"
          aria-hidden
        />
        Checking connection…
      </div>
    );
  if (!offline) return null;
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
