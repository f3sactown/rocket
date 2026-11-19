"use client";

/**
 * Your recent workouts and backblasts, always on this phone: whenever there's a connection,
 * Rocket fetches them whole (with a workout's private notes and what you've archived) and keeps
 * them, along with the Exicon, so they're there offline whatever screens you've opened. Offline,
 * the lists, a workout or backblast's page, Run workout, the editors and New backblast's choice of
 * workout all come from here; with a connection they load fresh as usual (and this copy is
 * fetched again: on opening Rocket, on reconnecting, every 10 minutes and after a save).
 */

import { isOffline } from "./connection";
import { keep, readKept } from "./kept";
import { loadLibrary } from "./library";
import { createClient } from "./supabase/client";
import type { Database } from "./supabase/database.types";

type WorkoutRow = Database["public"]["Tables"]["workouts"]["Row"];
type BackblastRow = Database["public"]["Tables"]["backblasts"]["Row"];

export type PocketWorkout = WorkoutRow & { author: { name: string } | null };
export type PocketBackblast = BackblastRow & {
  author: { name: string } | null;
};

export interface Pocket {
  /** When it was fetched (ms). */
  at: number;
  userId: string;
  workouts: PocketWorkout[];
  backblasts: PocketBackblast[];
  /** Each workout's private notes, by its ID. */
  notes: Record<string, string>;
  archived: { workout: string[]; backblast: string[] };
}

/** How many finished ones of each, newest by date, and how many drafts. */
const FINISHED = 60;
const DRAFTS = 30;
const KEY = "pocket";
const EVERY_MS = 10 * 60 * 1000;

/** Whose pocket to read: the signed-in user (set by PocketKeeper). */
let owner: string | null = null;
let memory: Pocket | null = null;
let fetching: Promise<void> | null = null;

export function setPocketOwner(userId: string | null) {
  if (owner !== userId) memory = null;
  owner = userId;
}

/** What's on this phone for the signed-in user, if anything. */
export async function readPocket(): Promise<Pocket | null> {
  if (!owner) return null;
  if (memory?.userId === owner) return memory;
  const kept = await readKept<Pocket>(KEY);
  memory = kept?.userId === owner ? kept : null;
  return memory;
}

async function rows<T>(
  table: "workouts" | "backblasts",
  userId: string,
  status: "published" | "draft",
): Promise<T[]> {
  const query = createClient()
    .from(table)
    .select(`*, author:profiles!${table}_author_id_fkey(name)`)
    .eq("author_id", userId)
    .eq("status", status);
  const { data, error } = await (status === "published"
    ? query
        .order("date", { ascending: false, nullsFirst: false })
        .limit(FINISHED)
    : query.order("updated_at", { ascending: false }).limit(DRAFTS));
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as T[];
}

/** Fetches your recent workouts and backblasts (and the Exicon) and keeps them on this phone. */
export function refreshPocket(userId: string): Promise<void> {
  if (isOffline()) return Promise.resolve();
  fetching ??= (async () => {
    const supabase = createClient();
    const [workouts, drafts, backblasts, backblastDrafts, wa, ba] =
      await Promise.all([
        rows<PocketWorkout>("workouts", userId, "published"),
        rows<PocketWorkout>("workouts", userId, "draft"),
        rows<PocketBackblast>("backblasts", userId, "published"),
        rows<PocketBackblast>("backblasts", userId, "draft"),
        supabase.from("workout_archives").select("workout_id"),
        supabase.from("backblast_archives").select("backblast_id"),
      ]);
    const allWorkouts = [...workouts, ...drafts];
    const notes: Record<string, string> = {};
    if (allWorkouts.length) {
      const { data } = await supabase
        .from("workout_notes")
        .select("workout_id, body")
        .in(
          "workout_id",
          allWorkouts.map((w) => w.id),
        );
      for (const n of data ?? []) notes[n.workout_id] = n.body ?? "";
    }
    const pocket: Pocket = {
      at: Date.now(),
      userId,
      workouts: allWorkouts,
      backblasts: [...backblasts, ...backblastDrafts],
      notes,
      archived: {
        workout: (wa.data ?? []).map((a) => a.workout_id as string),
        backblast: (ba.data ?? []).map((a) => a.backblast_id as string),
      },
    };
    memory = pocket;
    await keep(KEY, pocket);
    // The Exicon too (its own kept copy), for the Exicon screen and the forms' Exicon buttons.
    await loadLibrary().catch(() => {});
  })()
    .catch(() => {
      // Kept as it was; fetched again next time.
    })
    .finally(() => {
      fetching = null;
    });
  return fetching;
}

let soon: ReturnType<typeof setTimeout> | null = null;

/** After a save: fetched again in a little while (once, however many saves come meanwhile). */
export function refreshPocketSoon() {
  if (!owner) return;
  const userId = owner;
  if (soon) clearTimeout(soon);
  soon = setTimeout(() => {
    soon = null;
    void refreshPocket(userId);
  }, 8000);
}

export const POCKET_EVERY_MS = EVERY_MS;

/**
 * Loads fresh with a connection; offline (or if loading fails), from what's on this phone. Fails
 * only when neither can answer.
 */
export async function freshOrPocket<T>(
  fresh: () => Promise<T>,
  fromPocket: (pocket: Pocket) => T,
): Promise<T> {
  if (!isOffline()) {
    try {
      return await fresh();
    } catch (error) {
      const pocket = await readPocket();
      if (pocket) return fromPocket(pocket);
      throw error;
    }
  }
  const pocket = await readPocket();
  if (pocket) return fromPocket(pocket);
  return fresh();
}
