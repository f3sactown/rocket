"use client";

import { workoutLinkText } from "@rocket/core";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "./supabase/client";
import { useLoad } from "./use-region";

/** Whether a workout can be opened by other PAX: finished and public. */
async function isShareable(id: string): Promise<boolean> {
  const { data } = await createClient()
    .from("workouts")
    .select("status, visibility")
    .eq("id", id)
    .maybeSingle();
  return data?.status === "published" && data.visibility === "public";
}

/**
 * The closing line for a copied or shared backblast: a link to the workout it was made from,
 * asking PAX to like and reuse it. Only when the user has it on in Settings (the default) and the
 * workout is public, since others couldn't open a private one. `ready` is false while that's being
 * checked, so nothing is copied or shared without it.
 */
export function useWorkoutLinkState(workoutId: string | undefined): {
  link: string | undefined;
  ready: boolean;
} {
  const on = useAuth().user?.shareWorkoutLink ?? true;
  const id = on ? workoutId : undefined;
  const shareable = useLoad(id ? () => isShareable(id) : null, [id]);
  if (!id) return { link: undefined, ready: true };
  if (shareable.loading) return { link: undefined, ready: false };
  if (!shareable.value) return { link: undefined, ready: true };
  const base = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}`;
  return { link: workoutLinkText(`${base}/workout/?id=${id}`), ready: true };
}

/** The closing line alone, once known (see `useWorkoutLinkState`). */
export function useWorkoutLink(
  workoutId: string | undefined,
): string | undefined {
  return useWorkoutLinkState(workoutId).link;
}
