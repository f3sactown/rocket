import { termsFor, type Language } from "@rocket/core";
import { asItems, listColumns, type ListItem } from "./backblast-list";
import { loadRegions, loadSites } from "./regions";
import { createClient } from "./supabase/client";
import {
  loadWorkoutStats,
  NO_STATS,
  type WorkoutStats,
} from "./workout-social";

/**
 * Which region each AO belongs to, by AO name (lower case), for an organization's regions.
 */
async function aoRegions(language: Language): Promise<Map<string, string>> {
  const regions = (await loadRegions()).filter((r) => r.language === language);
  const byAo = new Map<string, string>();
  for (const region of regions)
    for (const site of await loadSites(region).catch(() => []))
      if (!byAo.has(site.name.toLowerCase()))
        byAo.set(site.name.toLowerCase(), region.name);
  return byAo;
}

/**
 * Public workouts from everyone, newest first, with their like and reuse counts. A workout counts
 * as F3 or FiA by its author's region (or, for an author who chose all of an organization's
 * regions, that organization); only those from `sources` are kept, plus any whose author has no
 * region (so they can't be told apart). For an author with all regions, the region shown is the one
 * the workout's AO belongs to, or just "F3" or "FiA" for an AO on no region's list.
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
      `${listColumns("workout")}, author_region:profiles!workouts_author_id_fkey(region_scope, region:regions!profiles_region_id_fkey(language, name))`,
    )
    .eq("status", "published")
    .eq("visibility", "public")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as {
    ao: string;
    author_region: {
      region_scope?: Language | null;
      region: { language: Language; name: string } | null;
    } | null;
  }[];
  // Each AO's region, for authors who post across all of an organization's regions.
  const scopes = [
    ...new Set(rows.flatMap((r) => r.author_region?.region_scope ?? [])),
  ];
  const aoMaps = new Map(
    await Promise.all(
      scopes.map(async (l) => [l, await aoRegions(l)] as const),
    ),
  );
  const workouts = asItems(
    "workout",
    rows
      .filter((row) => {
        const language =
          row.author_region?.region?.language ??
          row.author_region?.region_scope;
        return !language || sources.includes(language);
      })
      .map(({ author_region, ...row }) => {
        const scope = author_region?.region_scope;
        return {
          ...row,
          // An AO that's on no region's list (typed in by hand) shows just F3 or FiA.
          authorRegion: scope
            ? (aoMaps.get(scope)?.get(row.ao.trim().toLowerCase()) ??
              termsFor(scope).org)
            : (author_region?.region?.name ?? null),
        };
      }),
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
