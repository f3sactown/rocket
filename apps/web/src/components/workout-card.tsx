"use client";

import Link from "next/link";
import type { ListItem } from "@/lib/backblast-list";
import type { WorkoutStats } from "@/lib/workout-social";
import { WorkoutStatsBar } from "./workout-stats";

/** A short list of public workouts with their likes and reuses (like button on others'). */
export function WorkoutCards({
  workouts,
  stats,
  userId,
  onStatsChange,
}: {
  workouts: ListItem[];
  stats: Map<string, WorkoutStats>;
  userId: string;
  onStatsChange: (id: string, stats: WorkoutStats) => void;
}) {
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
            <span className="truncate text-sm text-muted">
              {[workout.ao, workout.author?.name].filter(Boolean).join(" · ")}
            </span>
            <WorkoutStatsBar
              compact
              workoutId={workout.id}
              stats={
                stats.get(workout.id) ?? { likes: 0, reuses: 0, liked: false }
              }
              canLike={workout.author_id !== userId}
              onChange={(next) => onStatsChange(workout.id, next)}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
