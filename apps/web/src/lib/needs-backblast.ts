"use client";

import {
  loadArchivedIds,
  localToday as today,
  type ListItem,
} from "./backblast-list";
import { createClient } from "./supabase/client";
import { useLoad } from "./use-region";

/**
 * IDs of your workouts that don't need a backblast flagged: those you've finished a backblast for,
 * and those you've archived.
 */
async function loadSettledWorkoutIds(userId: string): Promise<Set<string>> {
  const [backblasts, archived] = await Promise.all([
    createClient()
      .from("backblasts")
      .select("workout_id")
      .eq("author_id", userId)
      .eq("status", "published")
      .not("workout_id", "is", null)
      .limit(5000),
    loadArchivedIds("workout"),
  ]);
  if (backblasts.error) throw new Error(backblasts.error.message);
  return new Set([
    ...(backblasts.data ?? []).map((row) => row.workout_id as string),
    ...archived,
  ]);
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
 * workouts never are, and nor are ones you've archived. Loads only when the list holds one of yours that could need it.
 */
export function useNeedsBackblast(
  items: ListItem[],
  userId: string,
): (item: ListItem) => boolean {
  const any = items.some((item) => due(item, userId));
  const done = useLoad(any ? () => loadSettledWorkoutIds(userId) : null, [
    userId,
    any,
  ]);
  return (item) =>
    !!done.value && due(item, userId) && !done.value.has(item.id);
}
