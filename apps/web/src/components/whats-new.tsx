"use client";

import { releaseNotes } from "@rocket/core";
import { Fragment, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CurrentUser } from "./auth-provider";
import { CloseIcon } from "./icons";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
// Only this version's notes: someone who skipped a release sees just the latest.
const NOTES = releaseNotes(
  process.env.NEXT_PUBLIC_RELEASE_NOTES ?? "",
  VERSION,
);
/** How many items show before "Show more", to keep the note small. */
const FIRST = 4;

/** A changelog item with its **bold** parts bold and `code` marks dropped. */
function Item({ text }: { text: string }) {
  return text
    .replace(/`/g, "")
    .split(/\*\*(.+?)\*\*/)
    .map((part, i) =>
      i % 2 ? (
        <strong key={i} className="font-semibold text-ink">
          {part}
        </strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}

/**
 * Home's one-time note after an update: the version and its changelog summary, until it's
 * dismissed. The dismissal is saved to the account, so it doesn't come back on another device.
 */
export function WhatsNew({ user }: { user: CurrentUser }) {
  const [dismissed, setDismissed] = useState(false);
  const [all, setAll] = useState(false);
  if (!NOTES || dismissed || user.whatsNewSeen === VERSION) return null;

  function dismiss() {
    setDismissed(true);
    createClient()
      .auth.updateUser({ data: { whats_new_seen: VERSION } })
      .then(() => {});
  }

  const titled = NOTES.sections.length > 1;
  const total = NOTES.sections.reduce((n, s) => n + s.items.length, 0);
  // The first few items across the sections, or all of them once asked.
  const limit = all ? total : FIRST;
  const sections = NOTES.sections
    .map((section, i) => {
      const before = NOTES.sections
        .slice(0, i)
        .reduce((n, s) => n + s.items.length, 0);
      return {
        ...section,
        items: section.items.slice(0, Math.max(limit - before, 0)),
      };
    })
    .filter((section) => section.items.length);
  return (
    <aside
      aria-label="What's new"
      className="panel flex flex-col gap-3 border-accent/50 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="font-semibold text-ink">
            What&apos;s new in v{VERSION}
          </h2>
          {NOTES.date && (
            <span className="font-mono text-xs text-muted">{NOTES.date}</span>
          )}
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
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          {titled && <span className="label">{section.title}</span>}
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-soft marker:text-accent">
            {section.items.map((item) => (
              <li key={item}>
                <Item text={item} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {total > FIRST && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="link self-start text-sm"
        >
          {all ? "Show less" : `Show ${total - FIRST} more`}
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
