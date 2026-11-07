"use client";

import { buildChanges } from "@rocket/core";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CurrentUser } from "./auth-provider";
import { CloseIcon } from "./icons";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
const BUILD = process.env.NEXT_PUBLIC_BUILD_NUMBER ?? "";
// Only the latest build's changes: someone who skipped builds sees just the newest.
const CHANGES = buildChanges(process.env.NEXT_PUBLIC_BUILD_CHANGES ?? "");
/** How many changes show before "Show more", to keep the note small. */
const FIRST = 4;

/**
 * Home's one-time note after an update: the version, build number and what that build changed,
 * until it's dismissed. The dismissal is saved to the account (as the build number), so it
 * doesn't come back on another device; the next build brings a new note.
 */
export function WhatsNew({ user }: { user: CurrentUser }) {
  const [dismissed, setDismissed] = useState(false);
  const [all, setAll] = useState(false);
  if (!BUILD || !CHANGES.length || dismissed || user.whatsNewSeen === BUILD)
    return null;

  function dismiss() {
    setDismissed(true);
    createClient()
      .auth.updateUser({ data: { whats_new_seen: BUILD } })
      .then(() => {});
  }

  return (
    <aside
      aria-label="What's new"
      className="panel flex flex-col gap-3 border-accent/50 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="font-semibold text-ink">What&apos;s new</h2>
          <span className="font-mono text-xs text-muted">
            v{VERSION} · build {BUILD}
          </span>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-m-1 rounded-full p-1 text-muted transition-colors hover:text-ink"
        >
          <CloseIcon />
        </button>
      </div>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-soft marker:text-accent">
        {(all ? CHANGES : CHANGES.slice(0, FIRST)).map((change) => (
          <li key={change}>{change}</li>
        ))}
      </ul>
      {CHANGES.length > FIRST && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="link self-start text-sm"
        >
          {all ? "Show less" : `Show ${CHANGES.length - FIRST} more`}
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        className="self-start rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium text-ink transition hover:border-accent/60"
      >
        Got it
      </button>
    </aside>
  );
}
