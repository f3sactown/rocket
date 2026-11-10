"use client";

import { formatDate } from "@rocket/core";
import { useState } from "react";
import {
  linkBackblast,
  loadWorkoutsNeedingBackblast,
  type ListItem,
} from "@/lib/backblast-list";
import { useLoad } from "@/lib/use-region";

/**
 * For a backblast written without a workout: "Link to a workout", then a list of your finished
 * workouts that don't have a backblast yet, any with the same AO and date first. Choosing one
 * links them, so the backblast's page links to it and its copied text can end with the workout.
 */
export function LinkWorkout({
  userId,
  backblastId,
  ao,
  date,
  onLinked,
}: {
  userId: string;
  backblastId: string;
  ao: string;
  date: string;
  onLinked: (workoutId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workouts = useLoad(
    open ? () => loadWorkoutsNeedingBackblast(userId) : null,
    [open, userId],
  );
  const matches = (w: ListItem) =>
    !!date &&
    w.date === date &&
    w.ao.trim().toLowerCase() === ao.trim().toLowerCase();
  const list = [...(workouts.value ?? [])].sort(
    (a, b) => Number(matches(b)) - Number(matches(a)),
  );

  async function link(workoutId: string) {
    setError(null);
    try {
      await linkBackblast(backblastId, workoutId);
      onLinked(workoutId);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="link -mt-2 self-start text-sm"
      >
        Not from a workout · Link to a workout →
      </button>
    );

  return (
    <div className="panel flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between gap-3 px-2 pt-1">
        <span className="text-sm font-medium text-ink">Link to a workout</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="link text-sm"
        >
          Cancel
        </button>
      </div>
      {workouts.error ? (
        <p className="px-2 py-3 text-sm text-accent">{workouts.error}</p>
      ) : !workouts.value ? (
        <p className="px-2 py-3 text-sm text-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted">
          Every finished workout of yours already has a backblast.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => link(w.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-hover"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-ink">
                    {w.title || "Untitled workout"}
                  </span>
                  <span className="truncate text-xs text-muted">
                    {matches(w) ? "Same AO and date · " : ""}
                    {w.ao}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-ink-soft">
                  {w.date ? formatDate(w.date) : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="px-2 text-sm text-accent">{error}</p>}
    </div>
  );
}
