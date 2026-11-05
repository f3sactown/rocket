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

/** Makes a workout public (the default once finished) or private to its Q. */
export async function setVisibility(
  workoutId: string,
  visibility: "public" | "private",
) {
  const { error } = await createClient()
    .from("workouts")
    .update({ visibility })
    .eq("id", workoutId);
  if (error) throw new Error(error.message);
}
