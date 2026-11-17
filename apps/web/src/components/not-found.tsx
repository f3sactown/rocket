"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Whether an error is the connection failing, not the thing being missing. */
const isConnectionError = (error?: string) =>
  !!error && /fetch|network|load failed|internet/i.test(error);

/**
 * A workout or backblast that didn't load: offline (or with the connection failing), that it
 * isn't kept on this phone yet; otherwise that it's not found.
 */
export function NotFound({
  what,
  error,
}: {
  what: "workout" | "backblast";
  error?: string;
}) {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (!online || isConnectionError(error))
    return (
      <section className="card">
        <h1 className="card-title">Not kept on this phone</h1>
        <p className="text-ink-soft">
          You&apos;re offline, and this {what} hasn&apos;t been kept for offline
          use yet. Rocket keeps your recent and upcoming workouts, and anything
          you&apos;ve opened, each time Home opens with a connection.
        </p>
      </section>
    );
  return (
    <section className="card">
      <h1 className="card-title">
        {what === "workout" ? "Workout" : "Backblast"} not found
      </h1>
      {error && <p className="text-accent">{error}</p>}
    </section>
  );
}
