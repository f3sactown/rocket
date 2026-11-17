"use client";

import { localDrafts } from "@/lib/local-drafts";
import { createClient } from "@/lib/supabase/client";

/**
 * Signs out. Offline, only on this phone: Supabase can't be told, and asking it would leave you
 * signed in.
 */
export function signOut(offline: boolean) {
  return createClient().auth.signOut(offline ? { scope: "local" } : undefined);
}

/**
 * Before signing out offline: what it means. You can't sign back in until there's a connection;
 * what you wrote offline that hasn't reached Rocket stays on the phone and is saved once you're
 * back in this account; the copies kept for offline use go, until you're signed in online again.
 */
export function SignOutOffline({
  userId,
  onCancel,
}: {
  userId: string;
  onCancel: () => void;
}) {
  const unsent = localDrafts(undefined, userId).length;
  const button =
    "rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/60";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-out-offline-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
    >
      <div className="flex w-full max-w-md flex-col gap-3 rounded-3xl border border-line-strong bg-surface-raised p-5 shadow-2xl">
        <h2
          id="sign-out-offline-title"
          className="text-lg font-semibold text-ink"
        >
          Sign out while offline?
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-ink-soft marker:text-accent">
          <li>
            <strong className="text-ink">
              You can&apos;t sign back in until you&apos;re online.
            </strong>{" "}
            Until then Rocket shows only the sign-in screen.
          </li>
          <li>
            Your workouts, Run workout screens and backblasts kept for offline
            use are removed from this phone, so they won&apos;t open offline.
          </li>
          {unsent > 0 && (
            <li>
              <strong className="text-ink">
                {unsent === 1
                  ? "1 workout or backblast you wrote offline hasn't"
                  : `${unsent} workouts or backblasts you wrote offline haven't`}{" "}
                reached Rocket yet.
              </strong>{" "}
              {unsent === 1 ? "It stays" : "They stay"} on this phone and{" "}
              {unsent === 1 ? "is" : "are"} saved as soon as you sign back in to
              this account with a connection.
            </li>
          )}
          <li>
            Once you&apos;re online and signed in again, everything loads fresh
            and is kept on this phone for offline use again.
          </li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <button type="button" autoFocus onClick={onCancel} className={button}>
            Stay signed in
          </button>
          <button
            type="button"
            onClick={() => void signOut(true)}
            className="link text-sm"
          >
            Sign out anyway
          </button>
        </div>
      </div>
    </div>
  );
}
