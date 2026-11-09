import { asItems, listColumns, type ListItem } from "./backblast-list";
import { createClient } from "./supabase/client";

/** A workout's likes and reuses, and whether the signed-in user likes it. */
export interface WorkoutStats {
  likes: number;
  reuses: number;
  liked: boolean;
}

export const NO_STATS: WorkoutStats = { likes: 0, reuses: 0, liked: false };

/**
 * Like and reuse counts for workouts, by ID. Reuses count every workout made from one with Reuse,
 * archived or not (deleted ones drop out).
 */
export async function loadWorkoutStats(
  ids: string[],
): Promise<Map<string, WorkoutStats>> {
  const stats = new Map<string, WorkoutStats>();
  if (ids.length === 0) return stats;
  const { data, error } = await createClient().rpc("workout_stats", {
    p_ids: ids,
  });
  if (error) throw new Error(error.message);
  for (const row of data ?? [])
    stats.set(row.workout_id, {
      likes: Number(row.likes),
      reuses: Number(row.reuses),
      liked: row.liked,
    });
  return stats;
}

/** Likes or unlikes someone else's public workout. One like per person per workout. */
export async function setLiked(workoutId: string, liked: boolean) {
  const supabase = createClient();
  const { error } = liked
    ? await supabase
        .from("workout_likes")
        .upsert(
          { workout_id: workoutId },
          { onConflict: "user_id,workout_id", ignoreDuplicates: true },
        )
    : await supabase.from("workout_likes").delete().eq("workout_id", workoutId);
  if (error) throw new Error(error.message);
}

/** Makes a finished workout or backblast public (anyone signed in can see it) or private. */
export async function setVisibility(
  id: string,
  visibility: "public" | "private",
  kind: "workout" | "backblast" = "workout",
) {
  const { error } = await createClient()
    .from(kind === "workout" ? "workouts" : "backblasts")
    .update({ visibility })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * The likes and reuses your finished workouts have had from others, added up (private ones
 * included: their counts are kept).
 */
export async function loadMyTotals(
  userId: string,
): Promise<{ likes: number; reuses: number }> {
  const { data, error } = await createClient()
    .from("workouts")
    .select("id")
    .eq("author_id", userId)
    .eq("status", "published")
    .limit(1000);
  if (error) throw new Error(error.message);
  const stats = await loadWorkoutStats((data ?? []).map((w) => w.id));
  let likes = 0;
  let reuses = 0;
  for (const s of stats.values()) {
    likes += s.likes;
    reuses += s.reuses;
  }
  return { likes, reuses };
}

/**
 * The workouts you've liked, most recently liked first, with their stats. One made private (or
 * deleted) since drops out, since it can't be opened.
 */
export async function loadLikedWorkouts(userId: string): Promise<{
  workouts: ListItem[];
  stats: Map<string, WorkoutStats>;
}> {
  const supabase = createClient();
  const { data: likes, error } = await supabase
    .from("workout_likes")
    .select("workout_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const ids = (likes ?? []).map((l) => l.workout_id);
  if (!ids.length) return { workouts: [], stats: new Map() };
  const { data, error: workoutsError } = await supabase
    .from("workouts")
    .select(listColumns("workout"))
    .in("id", ids);
  if (workoutsError) throw new Error(workoutsError.message);
  const byId = new Map(asItems("workout", data).map((w) => [w.id, w]));
  const workouts = ids.flatMap((id) => byId.get(id) ?? []);
  return { workouts, stats: await loadWorkoutStats(workouts.map((w) => w.id)) };
}
