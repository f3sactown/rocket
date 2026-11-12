"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** The notice after saving a public workout dated after today. */
export const HIDDEN_UNTIL_THE_DAY = "hidden_until_the_day";

/** Every notice that can be silenced, by ID, with how Settings names it. */
export const NOTICES: Record<string, string> = {
  [HIDDEN_UNTIL_THE_DAY]: "Upcoming workouts are hidden until the day",
};

/**
 * A notice that pops up after something happens, with OK and a choice to keep showing it every
 * time or silence it. Silenced notices are saved to the account (`notices_off`) and come back from
 * Settings → Notifications.
 */
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
  const [silence, setSilence] = useState(false);
  const [busy, setBusy] = useState(false);

  async function close() {
    if (silence) {
      setBusy(true);
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
    onClose();
  }

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
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Show this notice</legend>
          {[
            { label: "Show every time", value: false },
            { label: "Don't show again", value: true },
          ].map((option) => (
            <label
              key={option.label}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                silence === option.value
                  ? "border-accent/60 bg-accent-soft text-ink"
                  : "border-line text-ink-soft hover:border-line-strong"
              }`}
            >
              <input
                type="radio"
                name={`${id}-show`}
                checked={silence === option.value}
                onChange={() => setSilence(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={close}
          className="btn self-end"
        >
          OK
        </button>
      </div>
    </div>
  );
}
