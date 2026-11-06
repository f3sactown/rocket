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
 * workout is public, since others couldn't open a private one.
 */
export function useWorkoutLink(
  workoutId: string | undefined,
): string | undefined {
  const on = useAuth().user?.shareWorkoutLink ?? true;
  const id = on ? workoutId : undefined;
  const shareable = useLoad(id ? () => isShareable(id) : null, [id]);
  if (!id || !shareable.value) return undefined;
  const base = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}`;
  return workoutLinkText(`${base}/workout/?id=${id}`);
}
