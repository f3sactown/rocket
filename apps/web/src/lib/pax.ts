import { asItems, listColumns, type ListItem } from "./backblast-list";
import { trending } from "./discover";
import { loadRegions, loadRoster, type Region } from "./regions";
import { createClient } from "./supabase/client";
import { loadWorkoutStats, type WorkoutStats } from "./workout-social";

/** A PAX's numbers in one region. */
export interface PaxRegion {
  id: string;
  name: string;
  posts: number;
  qs: number;
}

/** One PAX: a name on one or more regions' rosters, with their posts and Qs in each. */
export interface PaxEntry {
  name: string;
  regions: PaxRegion[];
  posts: number;
  qs: number;
  /** Likes and reuses across their public Rocket workouts (matched by account name). */
  likes: number;
  reuses: number;
}

/**
 * Likes and reuses added up per author name (lower case), across every public workout on Rocket.
 */
async function likesAndReusesByName(): Promise<
  Map<string, { likes: number; reuses: number }>
> {
  const supabase = createClient();
  const rows: { id: string; author: { name: string } | null }[] = [];
  const size = 1000;
  for (let from = 0; from < size * 20; from += size) {
    const { data, error } = await supabase
      .from("workouts")
      .select("id, author:profiles!workouts_author_id_fkey(name)")
      .eq("status", "published")
      .eq("visibility", "public")
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as typeof rows));
    if (!data || data.length < size) break;
  }
  const stats = await loadWorkoutStats(rows.map((r) => r.id));
  const totals = new Map<string, { likes: number; reuses: number }>();
  for (const row of rows) {
    const key = row.author?.name.trim().toLowerCase();
    if (!key) continue;
    const s = stats.get(row.id);
    const t = totals.get(key) ?? { likes: 0, reuses: 0 };
    t.likes += s?.likes ?? 0;
    t.reuses += s?.reuses ?? 0;
    totals.set(key, t);
  }
  return totals;
}

/** Every PAX's posts and Qs in a synced region, by name (lower case). */
async function regionStats(
  region: Region,
): Promise<Map<string, { posts: number; qs: number }>> {
  const stats = new Map<string, { posts: number; qs: number }>();
  if (!region.synced_at) return stats;
  const supabase = createClient();
  const size = 1000;
  // Page through (the database returns at most 1000 rows at a time).
  for (let from = 0; from < size * 20; from += size) {
    const { data, error } = await supabase
      .from("region_pax_stats")
      .select("pax, posts, qs")
      .eq("region_id", region.id)
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? [])
      stats.set(row.pax.trim().toLowerCase(), { posts: row.posts, qs: row.qs });
    if (!data || data.length < size) break;
  }
  return stats;
}

let cache: Promise<{ regions: Region[]; pax: PaxEntry[] }> | null = null;

/**
 * Every name on every region's roster, once each, with the regions that list it and their posts
 * and Qs there (from the nightly sync). Loaded once per visit.
 */
export function loadAllPax(): Promise<{ regions: Region[]; pax: PaxEntry[] }> {
  cache ??= (async () => {
    const [regions, social] = await Promise.all([
      loadRegions(),
      likesAndReusesByName().catch(
        () => new Map<string, { likes: number; reuses: number }>(),
      ),
    ]);
    const byName = new Map<string, PaxEntry>();
    await Promise.all(
      regions.map(async (region) => {
        const [names, stats] = await Promise.all([
          loadRoster(region).catch(() => [] as string[]),
          regionStats(region).catch(() => new Map()),
        ]);
        for (const name of names) {
          const key = name.trim().toLowerCase();
          if (!key) continue;
          const entry = byName.get(key) ?? {
            name: name.trim(),
            regions: [],
            posts: 0,
            qs: 0,
            ...(social.get(key) ?? { likes: 0, reuses: 0 }),
          };
          const s = stats.get(key) ?? { posts: 0, qs: 0 };
          entry.regions.push({ id: region.id, name: region.name, ...s });
          entry.posts += s.posts;
          entry.qs += s.qs;
          byName.set(key, entry);
        }
      }),
    );
    return {
      regions,
      pax: [...byName.values()].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    };
  })().catch((error) => {
    cache = null;
    throw error;
  });
  return cache;
}

/**
 * A PAX's public workouts on Rocket, matched to their roster name by their Rocket account's name:
 * the most recent first, and the ones getting the most attention lately.
 */
export async function loadPaxWorkouts(name: string): Promise<{
  hasAccount: boolean;
  recent: ListItem[];
  trending: ListItem[];
  stats: Map<string, WorkoutStats>;
}> {
  const supabase = createClient();
  const escaped = name.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data: people, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("name", escaped);
  if (error) throw new Error(error.message);
  const ids = (people ?? []).map((p) => p.id);
  if (!ids.length)
    return { hasAccount: false, recent: [], trending: [], stats: new Map() };
  const { data, error: workoutsError } = await supabase
    .from("workouts")
    .select(listColumns("workout"))
    .in("author_id", ids)
    .eq("status", "published")
    .eq("visibility", "public")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (workoutsError) throw new Error(workoutsError.message);
  const workouts = asItems("workout", data);
  const stats = await loadWorkoutStats(workouts.map((w) => w.id));
  return {
    hasAccount: true,
    recent: workouts.slice(0, 10),
    trending: trending(workouts, stats).slice(0, 10),
    stats,
  };
}
