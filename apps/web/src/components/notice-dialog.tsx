"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** The notice after saving a public workout dated after today. */
export const HIDDEN_UNTIL_THE_DAY = "hidden_until_the_day";
/** The note by the Public / Private switch after saving a workout or backblast. */
export const VISIBILITY_SWITCH = "visibility_switch";

/** Every notice that can be silenced, by ID, with how Settings names it. */
export const NOTICES: Record<string, string> = {
  [HIDDEN_UNTIL_THE_DAY]: "Upcoming workouts are hidden until the day",
  [VISIBILITY_SWITCH]: "What the Public / Private switch does",
};

/** Adds a notice to the account's silenced ones (`notices_off`). */
async function silence(id: string) {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const off = data.user?.user_metadata?.notices_off;
  const before = Array.isArray(off)
    ? off.filter((v): v is string => typeof v === "string")
    : [];
  await supabase.auth.updateUser({
    data: { notices_off: [...new Set([...before, id])] },
  });
}

/**
 * How a notice closes: a "Don't show again" checkbox, and OK to dismiss it. With the box ticked,
 * OK silences it too (Settings → Notifications brings it back).
 */
function NoticeChoices({ id, onClose }: { id: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [never, setNever] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={never}
          onChange={(e) => setNever(e.target.checked)}
          className="size-4 accent-[var(--color-accent)]"
        />
        Don&apos;t show again
      </label>
      <button
        type="button"
        autoFocus
        disabled={busy}
        onClick={async () => {
          if (never) {
            setBusy(true);
            await silence(id);
          }
          onClose();
        }}
        className="rounded-full border border-line-strong px-5 py-1.5 text-sm font-medium text-ink transition hover:border-accent/60 disabled:opacity-50"
      >
        OK
      </button>
    </div>
  );
}

/** A notice that pops up after something happens, closed with OK. */
export function NoticeDialog({
  id,
  title,
  onClose,
  children,
}: {
  id: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-line-strong bg-surface-raised p-5 shadow-2xl">
        <h2 id={`${id}-title`} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <p className="text-sm text-ink-soft">{children}</p>
        <NoticeChoices id={id} onClose={onClose} />
      </div>
    </div>
  );
}

/** The same kind of notice, shown in place on the page (e.g. by the control it explains). */
export function InlineNotice({
  id,
  onClose,
  children,
}: {
  id: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <aside
      aria-label="Notice"
      className="panel flex flex-col gap-3 border-accent/50 p-4"
    >
      <p className="text-sm text-ink-soft">{children}</p>
      <NoticeChoices id={id} onClose={onClose} />
    </aside>
  );
}

/**
 * Under the Public / Private switch once a workout or backblast is saved (the editor adds
 * `saved=1` to the page's address): what the switch is for, until dismissed or silenced.
 */
export function VisibilityNotice({
  kind,
  noticesOff,
}: {
  kind: "workout" | "backblast";
  noticesOff: string[];
}) {
  const saved = useSearchParams().get("saved") === "1";
  const [open, setOpen] = useState(true);
  if (!saved || !open || noticesOff.includes(VISIBILITY_SWITCH)) return null;
  return (
    <InlineNotice id={VISIBILITY_SWITCH} onClose={() => setOpen(false)}>
      The <strong className="text-ink">Public / Private</strong> switch sets who
      can see this {kind}.{" "}
      {kind === "workout"
        ? "Public: anyone signed in can see it on Discover and your PAX profile, and like and reuse it."
        : "Public: anyone signed in can see it on your PAX profile."}{" "}
      Private: only you. New {kind}s start as chosen in Settings → Sharing.
    </InlineNotice>
  );
}
