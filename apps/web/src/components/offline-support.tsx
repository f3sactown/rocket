"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { useConnection } from "@/lib/connection";
import { leftScreen, resumeKeeping } from "@/lib/offline";
import { SERVICE_WORKER_URL } from "@/lib/push";

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
      .register(SERVICE_WORKER_URL, { scope: `${BASE}/` })
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
        <strong className="text-ink">Offline.</strong> Write new workouts and
        backblasts as usual: they&apos;re kept on this phone and saved once
        you&apos;re back online. Your recent workouts and backblasts, the Exicon
        and About still show. Discover, Generate, Archive, Search, PAX and
        Settings need a connection.
      </span>
    </div>
  );
}

/**
 * Keeps the screen you leave for offline use first: when you move to another, or put Rocket away
 * (another app, the home screen, locking the phone).
 */
export function KeepOnLeave() {
  return (
    <Suspense fallback={null}>
      <LeaveWatcher />
    </Suspense>
  );
}

function LeaveWatcher() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = useRef({ pathname, search });

  useEffect(() => {
    // Not inside the hidden frames that keep the copies.
    if (window.top !== window) return;
    const before = current.current;
    current.current = { pathname, search };
    if (before.pathname !== pathname || before.search !== search)
      leftScreen(before.pathname, before.search);
  }, [pathname, search]);

  useEffect(() => {
    if (window.top !== window) return;
    resumeKeeping();
    // Back online: carry on with what's waiting.
    window.addEventListener("online", resumeKeeping);
    const away = () => {
      if (document.visibilityState === "hidden")
        leftScreen(current.current.pathname, current.current.search);
    };
    document.addEventListener("visibilitychange", away);
    return () => {
      window.removeEventListener("online", resumeKeeping);
      document.removeEventListener("visibilitychange", away);
    };
  }, []);

  return null;
}
