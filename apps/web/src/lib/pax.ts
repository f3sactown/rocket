import type { Language } from "@rocket/core";
import { asItems, listColumns, type ListItem } from "./backblast-list";
import { trending } from "./discover";
import {
  loadAllPaxStats,
  loadRegions,
  loadRoster,
  type Region,
} from "./regions";
import { createClient } from "./supabase/client";
import { loadWorkoutStats, type WorkoutStats } from "./workout-social";

/** A PAX's numbers in one region. */
export interface PaxRegion {
  id: string;
  name: string;
  posts: number;
  qs: number;
}

/**
 * One PAX: a name on one or more of an organization's regions' rosters, with their posts and Qs
 * in each. The same name in F3 and in FiA is two different PAX.
 */
export interface PaxEntry {
  name: string;
  org: Language;
  regions: PaxRegion[];
  posts: number;
  qs: number;
  /** Likes and reuses across their public Rocket workouts (matched by account name). */
  likes: number;
  reuses: number;
}

/** The key a PAX is known by: their organization and name (lower case), e.g. "f3:tinman". */
function paxKey(org: Language | "any", name: string): string {
  return `${org}:${name.trim().toLowerCase()}`;
}

/** An account's organization: its region's, or the one whose regions it chose all of. */
type AuthorOrg = {
  region_scope: Language | null;
  region: { language: Language } | null;
} | null;
function orgOf(author: AuthorOrg): Language | null {
  return author?.region?.language ?? author?.region_scope ?? null;
}

/**
 * Likes and reuses added up per author, keyed by `paxKey` with the author's organization (or
 * "any" for an author with no region, who can't be told apart), across every public workout.
 */
async function likesAndReusesByName(): Promise<
  Map<string, { likes: number; reuses: number }>
> {
  const supabase = createClient();
  const rows: {
    id: string;
    author: ({ name: string } & NonNullable<AuthorOrg>) | null;
  }[] = [];
  const size = 1000;
  for (let from = 0; from < size * 20; from += size) {
    const { data, error } = await supabase
      .from("workouts")
      .select(
        "id, author:profiles!workouts_author_id_fkey(name, region_scope, region:regions!profiles_region_id_fkey(language))",
      )
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
    if (!row.author?.name.trim()) continue;
    const key = paxKey(orgOf(row.author) ?? "any", row.author.name);
    const s = stats.get(row.id);
    const t = totals.get(key) ?? { likes: 0, reuses: 0 };
    t.likes += s?.likes ?? 0;
    t.reuses += s?.reuses ?? 0;
    totals.set(key, t);
  }
  return totals;
}

let cache: Promise<{ regions: Region[]; pax: PaxEntry[] }> | null = null;

/**
 * Every name on every region's roster, once per organization (the same name in F3 and FiA is two
 * PAX), with the regions that list it and their posts and Qs there (from the nightly sync). Loaded
 * once per visit.
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
          loadAllPaxStats(region).catch(() => new Map()),
        ]);
        for (const name of names) {
          const lower = name.trim().toLowerCase();
          if (!lower) continue;
          const key = paxKey(region.language, name);
          // Their own organization's, plus any from a same-named account with no region.
          const own = social.get(key) ?? { likes: 0, reuses: 0 };
          const any = social.get(paxKey("any", name)) ?? {
            likes: 0,
            reuses: 0,
          };
          const entry = byName.get(key) ?? {
            name: name.trim(),
            org: region.language,
            regions: [],
            posts: 0,
            qs: 0,
            likes: own.likes + any.likes,
            reuses: own.reuses + any.reuses,
          };
          const s = stats.get(lower) ?? { posts: 0, qs: 0 };
          entry.regions.push({ id: region.id, name: region.name, ...s });
          entry.posts += s.posts;
          entry.qs += s.qs;
          byName.set(key, entry);
        }
      }),
    );
    return {
      regions,
      pax: [...byName.values()].sort(
        (a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
          a.org.localeCompare(b.org),
      ),
    };
  })().catch((error) => {
    cache = null;
    throw error;
  });
  return cache;
}

/**
 * A PAX's public workouts on Rocket, matched to their roster name by their Rocket account's name
 * in the same organization (or an account with no region): the most recent first, and the ones
 * getting the most attention lately.
 */
export async function loadPaxWorkouts(
  name: string,
  org: Language,
): Promise<{
  hasAccount: boolean;
  recent: ListItem[];
  trending: ListItem[];
  stats: Map<string, WorkoutStats>;
}> {
  const supabase = createClient();
  const escaped = name.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data: people, error } = await supabase
    .from("profiles")
    .select(
      "id, region_scope, region:regions!profiles_region_id_fkey(language)",
    )
    .ilike("name", escaped);
  if (error) throw new Error(error.message);
  const ids = ((people ?? []) as unknown as ({ id: string } & AuthorOrg)[])
    .filter((p) => (orgOf(p) ?? org) === org)
    .map((p) => p.id);
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
