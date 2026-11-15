"use client";

import { useEffect, useState } from "react";
import {
  clockText,
  workoutTimes,
} from "../../../../supabase/functions/_shared/reminders";
import { beep, unlockAudio } from "./thang-timer";

/** How long before the workout's end time the warning comes. */
const WARN_MINUTES = 5;
/** A workout with a start time but no end is taken to run this long, as for reminders. */
const DEFAULT_LENGTH = 45;

/**
 * Run workout's 5-minute warning: on the workout's day, five minutes before the end of its time
 * (e.g. 5:55am for "5:15am-6:00am"), a banner with a beep and a buzz says it's time to wrap up.
 * Nothing shows for a workout with no time, or on another day.
 */
export function WrapUpWarning({
  date,
  time,
}: {
  date: string | null | undefined;
  time: string | null | undefined;
}) {
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { start, end } = workoutTimes(time);
  const finish = end ?? (start !== null ? start + DEFAULT_LENGTH : null);

  // Phones only let a page beep once it's been tapped: any tap on the run screen will do.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (!date || finish === null) return;
    const [y, m, d] = date.split("-").map(Number);
    const at = (minutes: number) =>
      new Date(y!, m! - 1, d!, 0, minutes).getTime();
    const warnAt = at(finish - WARN_MINUTES);
    const endAt = at(finish);
    const check = () => {
      const now = Date.now();
      if (now >= warnAt && now < endAt) {
        setShown(true);
        beep("end");
        clearInterval(timer);
      }
    };
    const timer = setInterval(check, 5000);
    // Already in the last five minutes when the screen opens: say so now.
    const first = setTimeout(check, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
    };
  }, [date, finish]);

  if (!shown || dismissed || finish === null) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-3 bottom-4 z-30 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-accent bg-accent-soft px-4 py-3 shadow-xl backdrop-blur"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-ink">
          {WARN_MINUTES} minutes left
        </span>
        <span className="text-sm text-ink-soft">
          The workout ends at {clockText(finish)}. Time to wrap up for COT.
        </span>
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded-full border border-line-strong px-3 py-1.5 text-sm font-medium text-ink"
      >
        OK
      </button>
    </div>
  );
}
