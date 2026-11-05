"use client";

import Link from "next/link";
import type { ListItem } from "@/lib/backblast-list";
import { useNeedsBackblast } from "@/lib/needs-backblast";
import type { WorkoutStats } from "@/lib/workout-social";
import { NeedsBackblastBadge } from "./backblast-list";
import { WorkoutStatsBar } from "./workout-stats";

/** "Tinman • F3 SacTown", or just the name when the author has no region (or it isn't loaded). */
function byline(workout: ListItem): string {
  return [workout.author?.name, workout.authorRegion]
    .filter(Boolean)
    .join(" • ");
}

/**
 * Public workouts with their likes and reuses (like button on others'), as a list or, with
 * `tiles`, a grid of tiles that also names each author's region.
 */
export function WorkoutCards({
  workouts,
  stats,
  userId,
  onStatsChange,
  tiles = false,
}: {
  workouts: ListItem[];
  stats: Map<string, WorkoutStats>;
  userId: string;
  onStatsChange: (id: string, stats: WorkoutStats) => void;
  tiles?: boolean;
}) {
  const needsBackblast = useNeedsBackblast(workouts, userId);
  const statsBar = (workout: ListItem) => (
    <WorkoutStatsBar
      compact
      workoutId={workout.id}
      stats={stats.get(workout.id) ?? { likes: 0, reuses: 0, liked: false }}
      canLike={workout.author_id !== userId}
      onChange={(next) => onStatsChange(workout.id, next)}
    />
  );

  if (tiles)
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {workouts.map((workout) => (
          <li key={workout.id} className="min-w-0">
            <Link
              href={`/workout?id=${workout.id}`}
              className="panel flex h-full flex-col gap-2 p-3 transition-colors hover:border-accent/40"
            >
              <span className="line-clamp-2 font-medium break-words text-ink">
                {workout.title || "Untitled workout"}
              </span>
              <span className="flex flex-col gap-0.5 text-xs">
                <span className="truncate text-ink-soft">{workout.ao}</span>
                <span className="truncate text-muted">{byline(workout)}</span>
                <span className="font-mono text-muted">{workout.date}</span>
              </span>
              {needsBackblast(workout) && (
                <span className="self-start">
                  <NeedsBackblastBadge />
                </span>
              )}
              <span className="mt-auto pt-1">{statsBar(workout)}</span>
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <ul className="panel flex flex-col divide-y divide-line p-2">
      {workouts.map((workout) => (
        <li key={workout.id}>
          <Link
            href={`/workout?id=${workout.id}`}
            className="flex flex-col gap-1.5 rounded-xl px-3 py-3 transition-colors hover:bg-hover"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate font-medium text-ink">
                {workout.title || "Untitled workout"}
              </span>
              <span className="shrink-0 font-mono text-xs text-ink-soft">
                {workout.date}
              </span>
            </span>
            <span className="flex items-center justify-between gap-3">
              <span className="truncate text-sm text-muted">
                {[workout.ao, byline(workout)].filter(Boolean).join(" · ")}
              </span>
              {needsBackblast(workout) && <NeedsBackblastBadge />}
            </span>
            {statsBar(workout)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
