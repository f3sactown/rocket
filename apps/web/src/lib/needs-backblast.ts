"use client";

import { localToday as today, type ListItem } from "./backblast-list";
import { createClient } from "./supabase/client";
import { useLoad } from "./use-region";

/** IDs of workouts you've finished a backblast for (backblasts are only ever your own). */
async function loadBackblastedWorkoutIds(): Promise<Set<string>> {
  const { data, error } = await createClient()
    .from("backblasts")
    .select("workout_id")
    .eq("status", "published")
    .not("workout_id", "is", null)
    .limit(5000);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.workout_id as string));
}

/**
 * Whether a workout could have a backblast by now: yours, finished, and dated today or earlier
 * (one planned for later can't have been run yet).
 */
function due(item: ListItem, userId: string): boolean {
  return (
    item.kind === "workout" &&
    item.status === "published" &&
    item.author_id === userId &&
    (!item.date || item.date <= today())
  );
}

/**
 * Tells which of these workouts are yours and still waiting on a finished backblast. Others'
 * workouts never are. Loads only when the list holds one of yours that could need it.
 */
export function useNeedsBackblast(
  items: ListItem[],
  userId: string,
): (item: ListItem) => boolean {
  const any = items.some((item) => due(item, userId));
  const done = useLoad(any ? loadBackblastedWorkoutIds : null, [userId, any]);
  return (item) =>
    !!done.value && due(item, userId) && !done.value.has(item.id);
}
