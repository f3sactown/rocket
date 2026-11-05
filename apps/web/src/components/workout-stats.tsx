"use client";

import { useState } from "react";
import { setLiked, type WorkoutStats } from "@/lib/workout-social";
import { HeartIcon, ReuseIcon } from "./icons";

/**
 * A workout's likes and reuses. Someone else's public workout gets a like button (one like per
 * person); your own just shows the counts.
 */
export function WorkoutStatsBar({
  workoutId,
  stats,
  canLike,
  onChange,
  compact = false,
}: {
  workoutId: string;
  stats: WorkoutStats;
  canLike: boolean;
  onChange: (stats: WorkoutStats) => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const liked = !stats.liked;
    setBusy(true);
    setError(null);
    // Show it straight away, and put it back if saving fails.
    onChange({ ...stats, liked, likes: stats.likes + (liked ? 1 : -1) });
    try {
      await setLiked(workoutId, liked);
    } catch (e) {
      onChange(stats);
      setError((e as Error).message);
    }
    setBusy(false);
  }

  const likes = `${stats.likes} ${stats.likes === 1 ? "like" : "likes"}`;
  const reuses = `${stats.reuses} ${stats.reuses === 1 ? "reuse" : "reuses"}`;
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${compact ? "text-xs" : "text-sm"} text-ink-soft`}
    >
      {canLike ? (
        <button
          type="button"
          aria-pressed={stats.liked}
          aria-label={stats.liked ? `Unlike (${likes})` : `Like (${likes})`}
          disabled={busy}
          onClick={(e) => {
            // Inside a card that links to the workout, a tap on the heart only likes it.
            e.preventDefault();
            e.stopPropagation();
            toggle();
          }}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors ${
            stats.liked
              ? "border-accent/60 bg-accent-soft text-accent"
              : "border-line hover:border-line-strong hover:text-ink"
          }`}
        >
          <HeartIcon filled={stats.liked} />
          {stats.likes}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5" title={likes}>
          <span className="text-accent">
            <HeartIcon filled={stats.likes > 0} />
          </span>
          {compact ? stats.likes : likes}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5" title={reuses}>
        <span className="text-accent">
          <ReuseIcon />
        </span>
        {compact ? stats.reuses : reuses}
      </span>
      {error && <span className="text-accent">{error}</span>}
    </div>
  );
}
