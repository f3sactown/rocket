import type { Language } from "@rocket/core";
import { asItems, listColumns, type ListItem } from "./backblast-list";
import { createClient } from "./supabase/client";
import {
  loadWorkoutStats,
  NO_STATS,
  type WorkoutStats,
} from "./workout-social";

/**
 * Public workouts from everyone, newest first, with their like and reuse counts. A workout counts
 * as F3 or FiA by its author's region; only those from `sources` are kept, plus any whose author
 * has no region (so they can't be told apart).
 */
export async function loadPublicWorkouts(
  sources: Language[] = ["f3", "fia"],
): Promise<{
  workouts: ListItem[];
  stats: Map<string, WorkoutStats>;
}> {
  const { data, error } = await createClient()
    .from("workouts")
    .select(
      `${listColumns("workout")}, author_region:profiles!workouts_author_id_fkey(region:regions!profiles_region_id_fkey(language, name))`,
    )
    .eq("status", "published")
    .eq("visibility", "public")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as {
    author_region: {
      region: { language: Language; name: string } | null;
    } | null;
  }[];
  const workouts = asItems(
    "workout",
    rows
      .filter((row) => {
        const language = row.author_region?.region?.language;
        return !language || sources.includes(language);
      })
      .map(({ author_region, ...row }) => ({
        ...row,
        authorRegion: author_region?.region?.name ?? null,
      })),
  );
  return { workouts, stats: await loadWorkoutStats(workouts.map((w) => w.id)) };
}

/** How far back a workout can be and still trend. */
const TRENDING_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

/**
 * Workouts getting attention lately: likes and reuses (a reuse counts double), divided by how long
 * ago the workout was, so newer ones rise. Only the last 30 days, and only ones with some.
 */
export function trending(
  workouts: ListItem[],
  stats: Map<string, WorkoutStats>,
  today = new Date(),
): ListItem[] {
  const score = (w: ListItem) => {
    const s = stats.get(w.id) ?? NO_STATS;
    const days = w.date
      ? Math.max(
          0,
          (today.getTime() - new Date(`${w.date}T12:00:00`).getTime()) / DAY,
        )
      : TRENDING_DAYS;
    return days > TRENDING_DAYS
      ? 0
      : (s.likes + 2 * s.reuses) / (days + 2) ** 1.5;
  };
  return workouts
    .map((w) => ({ w, score: score(w) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.w);
}
