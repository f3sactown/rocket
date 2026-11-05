import { asItems, listColumns, type ListItem } from "./backblast-list";
import { createClient } from "./supabase/client";
import {
  loadWorkoutStats,
  NO_STATS,
  type WorkoutStats,
} from "./workout-social";

/** Public workouts from everyone, newest first, with their like and reuse counts. */
export async function loadPublicWorkouts(): Promise<{
  workouts: ListItem[];
  stats: Map<string, WorkoutStats>;
}> {
  const { data, error } = await createClient()
    .from("workouts")
    .select(listColumns("workout"))
    .eq("status", "published")
    .eq("visibility", "public")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const workouts = asItems("workout", data);
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
