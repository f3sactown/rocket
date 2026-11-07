import type { Language } from "@rocket/core";
import { createClient } from "./supabase/client";
import { cellText, quote, querySheet, type SheetTable } from "./sheets";

/** Which tabs and columns (by header name) hold a region's data. */
export interface RegionConfig {
  sites: {
    sheet: string;
    ao: string;
    address: string;
    location?: string;
    day?: string;
    time?: string;
    retired?: string;
  };
  roster: { sheet: string; name: string };
  attendance: {
    sheet: string;
    date: string;
    ao: string;
    pax: string;
    post: string;
    q: string;
  };
}

export interface Region {
  id: string;
  name: string;
  sheet_id: string;
  /** F3 or FiA; choosing the region sets the user's wording and accent to match. */
  language: Language;
  config: RegionConfig;
  created_by: string | null;
  /** When the region was added; it sets the region's Library color. */
  created_at?: string;
  /** When the nightly sync last copied the sheet into Supabase; null until the first sync. */
  synced_at: string | null;
  /** The newest post date in the attendance records, as of the last nightly sync. */
  latest_post_on?: string | null;
  /** Why the last sync failed, if it did (the previous copy is kept). */
  sync_error: string | null;
}

/** Column names from F3 SacTown's sheet, offered as the starting point for a new region. */
export const DEFAULT_CONFIG: RegionConfig = {
  sites: {
    sheet: "Sites",
    ao: "AO Name",
    address: "Address",
    location: "Location",
    day: "Day",
    time: "Time",
    retired: "Retired",
  },
  roster: { sheet: "Roster", name: "F3 Name" },
  attendance: {
    sheet: "Master Data",
    date: "Post Date",
    ao: "AO Name",
    pax: "PAX Name",
    post: "Post",
    q: "Q",
  },
};

export interface Site {
  name: string;
  /** "Location - Address", e.g. "Oki Park - 2715 Wissemann Dr, Sacramento, CA 95826". */
  address: string;
  day: string;
  time: string;
}

export interface Regular {
  name: string;
  posts: number;
}

export interface PaxStats {
  posts: number;
  qs: number;
}

/** How far back "regulars" at an AO are counted. */
export const REGULARS_MONTHS = 3;

let regionsCache: Promise<Region[]> | null = null;

/** Every region, by name. Cached for the page's lifetime; `refresh` reloads after a change. */
export function loadRegions(refresh = false): Promise<Region[]> {
  if (!regionsCache || refresh) {
    regionsCache = Promise.resolve(
      createClient()
        .from("regions")
        .select(
          "id, name, sheet_id, language, config, created_by, created_at, synced_at, sync_error, latest_post_on",
        )
        .order("name"),
    ).then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []) as unknown as Region[];
    });
    regionsCache.catch(() => (regionsCache = null));
  }
  return regionsCache;
}

// Reads are cached per page load so moving between steps doesn't re-download. Regions that have
// synced read the nightly copy in Supabase; until then they read the sheet live.
const cache = new Map<string, Promise<unknown>>();
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) {
    const promise = load();
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
  }
  return cache.get(key) as Promise<T>;
}

/** Maps each header name (case-insensitive) in a tab to its column letter. */
function columnsOf(sheetId: string, tab: string): Promise<Map<string, string>> {
  return cached(`cols:${sheetId}:${tab}`, async () => {
    const table = await querySheet(sheetId, tab, "select * limit 0");
    return new Map(
      table.cols.map((col) => [col.label.trim().toLowerCase(), col.id]),
    );
  });
}

/** Matches text exactly but case-insensitively in an `ilike` filter. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Reads a region's rows from one of the nightly-synced tables. */
async function synced<T>(
  table: "region_sites" | "region_roster",
  columns: string,
  region: Region,
  orderBy: string,
): Promise<T[]> {
  const { data, error } = await createClient()
    .from(table)
    .select(columns)
    .eq("region_id", region.id)
    .order(orderBy);
  if (error) throw error;
  return data as unknown as T[];
}

/** Column letters for the given header names; throws naming any that are missing. */
async function columns<K extends string>(
  sheetId: string,
  tab: string,
  names: { [P in K]?: string },
): Promise<{ [P in K]?: string }> {
  const found = await columnsOf(sheetId, tab);
  const missing: string[] = [];
  const result: { [P in K]?: string } = {};
  for (const key of Object.keys(names) as K[]) {
    const name = names[key]?.trim();
    if (!name) continue;
    const id = found.get(name.toLowerCase());
    if (id) result[key] = id;
    else missing.push(name);
  }
  if (missing.length)
    throw new Error(
      `Couldn't find ${missing.map((m) => `"${m}"`).join(", ")} in the "${tab}" tab.`,
    );
  return result;
}

function rows(table: SheetTable): string[][] {
  return table.rows.map((row) => row.c.map((cell) => cellText(cell)));
}

/** The region's active AOs (retired ones are left out), by name. */
export function loadSites(region: Region): Promise<Site[]> {
  if (region.synced_at)
    return cached(`sites:${region.id}`, () =>
      synced<Site>("region_sites", "name, address, day, time", region, "name"),
    );
  const { sheet, ...names } = region.config.sites;
  return cached(`sites:${region.id}`, async () => {
    const cols = await columns(region.sheet_id, sheet, names);
    const keys = (Object.keys(cols) as (keyof typeof cols)[]).filter(
      (k) => cols[k],
    );
    const table = await querySheet(
      region.sheet_id,
      sheet,
      `select ${keys.map((k) => cols[k]).join(", ")}`,
    );
    const get = (row: string[], key: keyof typeof cols) => {
      const i = keys.indexOf(key);
      return i >= 0 ? row[i] : "";
    };
    return rows(table)
      .filter((row) => get(row, "ao"))
      .filter((row) => !/^(y|yes|true|x)$/i.test(get(row, "retired")))
      .map((row) => ({
        name: get(row, "ao"),
        // Where the AO meets: its location (usually a park), else its address.
        address: get(row, "location") || get(row, "address"),
        day: get(row, "day"),
        time: get(row, "time"),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

/** Every PAX name on the region's roster, sorted. */
export function loadRoster(region: Region): Promise<string[]> {
  if (region.synced_at)
    return cached(`roster:${region.id}`, async () =>
      (
        await synced<{ name: string }>("region_roster", "name", region, "name")
      ).map((r) => r.name),
    );
  const { sheet, name } = region.config.roster;
  return cached(`roster:${region.id}`, async () => {
    const cols = await columns(region.sheet_id, sheet, { name });
    const table = await querySheet(
      region.sheet_id,
      sheet,
      `select ${cols.name}`,
    );
    return [
      ...new Set(
        rows(table)
          .map((row) => row[0])
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));
  });
}

/** Who has posted at an AO in the last few months, most posts first. */
export function loadRegulars(region: Region, ao: string): Promise<Regular[]> {
  if (region.synced_at)
    return cached(`regulars:${region.id}:${ao.toLowerCase()}`, async () => {
      const { data, error } = await createClient()
        .from("region_regulars")
        .select("pax, posts")
        .eq("region_id", region.id)
        .ilike("ao", escapeLike(ao))
        .order("posts", { ascending: false })
        .order("pax");
      if (error) throw error;
      return data.map((r) => ({ name: r.pax, posts: r.posts }));
    });
  const { sheet, date, ao: aoName, pax } = region.config.attendance;
  return cached(`regulars:${region.id}:${ao.toLowerCase()}`, async () => {
    const cols = await columns(region.sheet_id, sheet, {
      date,
      ao: aoName,
      pax,
    });
    const since = new Date();
    since.setMonth(since.getMonth() - REGULARS_MONTHS);
    const table = await querySheet(
      region.sheet_id,
      sheet,
      `select ${cols.pax}, count(${cols.pax}) where ${cols.ao} = ${quote(ao)} and ${cols.date} >= date '${since.toISOString().slice(0, 10)}' group by ${cols.pax} order by count(${cols.pax}) desc`,
    );
    return rows(table)
      .filter((row) => row[0])
      .map((row) => ({ name: row[0], posts: Number(row[1]) || 0 }));
  });
}

/**
 * Every PAX's total posts and Qs in the region's records, by name (lower case): from the nightly
 * sync, or straight from the sheet for a region that hasn't been synced yet (e.g. one just added).
 */
export function loadAllPaxStats(
  region: Region,
): Promise<Map<string, PaxStats>> {
  return cached(`allstats:${region.id}`, async () => {
    const stats = new Map<string, PaxStats>();
    if (region.synced_at) {
      const size = 1000;
      // Page through (the database returns at most 1000 rows at a time).
      for (let from = 0; from < size * 20; from += size) {
        const { data, error } = await createClient()
          .from("region_pax_stats")
          .select("pax, posts, qs")
          .eq("region_id", region.id)
          .range(from, from + size - 1);
        if (error) throw error;
        for (const row of data ?? [])
          stats.set(row.pax.trim().toLowerCase(), {
            posts: row.posts,
            qs: row.qs,
          });
        if (!data || data.length < size) break;
      }
      return stats;
    }
    const { sheet, pax, post, q } = region.config.attendance;
    const cols = await columns(region.sheet_id, sheet, { pax, post, q });
    const table = await querySheet(
      region.sheet_id,
      sheet,
      `select ${cols.pax}, sum(${cols.post}), sum(${cols.q}) group by ${cols.pax}`,
    );
    for (const [name, posts, qs] of rows(table))
      if (name?.trim())
        stats.set(name.trim().toLowerCase(), {
          posts: Math.round(Number(posts) || 0),
          qs: Math.round(Number(qs) || 0),
        });
    return stats;
  });
}

/** A PAX's total posts and Qs in the region's records. */
export function loadPaxStats(region: Region, name: string): Promise<PaxStats> {
  if (region.synced_at)
    return cached(`stats:${region.id}:${name.toLowerCase()}`, async () => {
      const { data, error } = await createClient()
        .from("region_pax_stats")
        .select("posts, qs")
        .eq("region_id", region.id)
        .ilike("pax", escapeLike(name.trim()))
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return { posts: data?.posts ?? 0, qs: data?.qs ?? 0 };
    });
  const { sheet, pax, post, q } = region.config.attendance;
  return cached(`stats:${region.id}:${name.toLowerCase()}`, async () => {
    const cols = await columns(region.sheet_id, sheet, { pax, post, q });
    const table = await querySheet(
      region.sheet_id,
      sheet,
      `select sum(${cols.post}), sum(${cols.q}) where ${cols.pax} = ${quote(name)}`,
    );
    const [posts, qs] = rows(table)[0] ?? [];
    return { posts: Number(posts) || 0, qs: Number(qs) || 0 };
  });
}

/** Checks a region's sheet and column names, returning a short summary of what was found. */
export async function checkRegion(
  sheetId: string,
  config: RegionConfig,
): Promise<string> {
  const probe: Region = {
    id: `check:${sheetId}:${Date.now()}`,
    name: "",
    sheet_id: sheetId,
    language: "f3",
    config,
    created_by: null,
    synced_at: null,
    sync_error: null,
  };
  const [sites, roster] = await Promise.all([
    loadSites(probe),
    loadRoster(probe),
    columns(sheetId, config.attendance.sheet, {
      date: config.attendance.date,
      ao: config.attendance.ao,
      pax: config.attendance.pax,
      post: config.attendance.post,
      q: config.attendance.q,
    }),
  ]);
  return `Found ${sites.length} active AOs and ${roster.length} PAX, and the attendance columns.`;
}

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** The weekday (0 = Monday) named at the start of a sheet value like "Saturday " or "Sat", or 7. */
function weekdayIndex(day: string): number {
  const start = day.trim().slice(0, 3).toLowerCase();
  const index = WEEKDAYS.findIndex(
    (d) => d.slice(0, 3).toLowerCase() === start,
  );
  return index < 0 ? WEEKDAYS.length : index;
}

/** Minutes after midnight of the first time in a value like "5:15am-6:00am", or a day's worth. */
export function startMinutes(time: string): number {
  const match = /(\d{1,2})(?::(\d{2}))?\s*([ap])?/i.exec(time);
  if (!match) return 24 * 60;
  let hours = Number(match[1]) % 12;
  if (match[3]?.toLowerCase() === "p" || (!match[3] && Number(match[1]) === 12))
    hours += 12;
  return hours * 60 + Number(match[2] ?? 0);
}

/** AOs grouped by weekday (Monday first), each day by start time then name. */
export function sitesByDay(sites: Site[]): { day: string; sites: Site[] }[] {
  const groups = new Map<number, Site[]>();
  for (const site of sites) {
    const index = weekdayIndex(site.day ?? "");
    groups.set(index, [...(groups.get(index) ?? []), site]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, list]) => ({
      day: WEEKDAYS[index] ?? "Other days",
      sites: list.sort(
        (a, b) =>
          startMinutes(a.time ?? "") - startMinutes(b.time ?? "") ||
          a.name.localeCompare(b.name),
      ),
    }));
}

/**
 * Minutes after midnight of the end of a time like "5:15am-6:00am", or its start if no end; a day's
 * worth when there's no time at all.
 */
export function endMinutes(time: string): number {
  const parts = time.split(/[-–]/);
  return startMinutes(parts[parts.length - 1]!.trim() || time);
}

/**
 * The next date (YYYY-MM-DD, local time) on the weekday a sheet value like "Tuesday" names, or
 * null if the value names no weekday. Today counts until the AO's time (e.g. "5:15am-6:00am") is
 * over.
 */
export function nextDateOn(
  day: string,
  time = "",
  from = new Date(),
): string | null {
  const index = weekdayIndex(day);
  if (index >= WEEKDAYS.length) return null;
  // weekdayIndex counts from Monday; getDay counts from Sunday.
  let ahead = (((index + 1) % 7) - from.getDay() + 7) % 7;
  // Once today's workout is over, the next one is a week away.
  const minutesNow = from.getHours() * 60 + from.getMinutes();
  if (ahead === 0 && time && endMinutes(time) <= minutesNow) ahead = 7;
  const date = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + ahead,
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A sheet date as YYYY-MM-DD: the API sends dates as "Date(2026,9,31)", with months from 0. */
function sheetDate(value: string): string | null {
  const match = /^Date\((\d+),(\d+),(\d+)/.exec(value);
  if (match)
    return `${match[1]}-${String(Number(match[2]) + 1).padStart(2, "0")}-${match[3]!.padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

/** The most recent post date (YYYY-MM-DD) in the region's attendance records, if any. */
export function loadLatestPost(region: Region): Promise<string | null> {
  if (region.synced_at) return Promise.resolve(region.latest_post_on ?? null);
  const { sheet, date } = region.config.attendance;
  return cached(`latest:${region.id}`, async () => {
    const cols = await columns(region.sheet_id, sheet, { date });
    const table = await querySheet(
      region.sheet_id,
      sheet,
      `select max(${cols.date})`,
    );
    return sheetDate(rows(table)[0]?.[0] ?? "");
  });
}

/** How many region colors there are (--region-0 … in globals.css); after that they repeat. */
export const REGION_COLOR_COUNT = 10;

/**
 * Each region's Library color, as a CSS value. Colors go out in the order regions were added, so
 * every user sees the same color for a region, and adding a region never changes the others'.
 */
export function regionColors(regions: Region[]): Map<string, string> {
  const ordered = [...regions].sort(
    (a, b) =>
      (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
      a.id.localeCompare(b.id),
  );
  return new Map(
    ordered.map((region, index) => [
      region.id,
      `var(--region-${index % REGION_COLOR_COUNT})`,
    ]),
  );
}

/**
 * Runs a load for each region and combines what comes back. A region that fails is skipped; the
 * load fails only if every region does.
 */
async function acrossRegions<T, R>(
  regions: Region[],
  load: (region: Region) => Promise<T>,
  combine: (results: T[]) => R,
): Promise<R> {
  const settled = await Promise.allSettled(regions.map(load));
  const ok = settled.flatMap((s) =>
    s.status === "fulfilled" ? [s.value] : [],
  );
  if (regions.length && !ok.length)
    throw (settled[0] as PromiseRejectedResult).reason;
  return combine(ok);
}

/** Every AO in these regions, by name (the first region's wins if two share a name). */
export function loadSitesIn(regions: Region[]): Promise<Site[]> {
  return acrossRegions(regions, loadSites, (lists) => {
    const byName = new Map<string, Site>();
    for (const site of lists.flat())
      if (!byName.has(site.name.toLowerCase()))
        byName.set(site.name.toLowerCase(), site);
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  });
}

/** Every PAX name on these regions' rosters, once each, sorted. */
export function loadRosterIn(regions: Region[]): Promise<string[]> {
  return acrossRegions(regions, loadRoster, (lists) =>
    [...new Set(lists.flat())].sort((a, b) => a.localeCompare(b)),
  );
}

/** Who has posted at an AO lately across these regions, most posts first. */
export function loadRegularsIn(
  regions: Region[],
  ao: string,
): Promise<Regular[]> {
  return acrossRegions(
    regions,
    (region) => loadRegulars(region, ao),
    (lists) => {
      const posts = new Map<string, number>();
      for (const r of lists.flat())
        posts.set(r.name, (posts.get(r.name) ?? 0) + r.posts);
      return [...posts]
        .map(([name, count]) => ({ name, posts: count }))
        .sort((a, b) => b.posts - a.posts || a.name.localeCompare(b.name));
    },
  );
}

/** A PAX's posts and Qs added up across these regions. */
export function loadPaxStatsIn(
  regions: Region[],
  name: string,
): Promise<PaxStats> {
  return acrossRegions(
    regions,
    (region) => loadPaxStats(region, name),
    (all) => ({
      posts: all.reduce((sum, s) => sum + s.posts, 0),
      qs: all.reduce((sum, s) => sum + s.qs, 0),
    }),
  );
}

/** The newest post date across these regions. */
export function loadLatestPostIn(regions: Region[]): Promise<string | null> {
  return acrossRegions(regions, loadLatestPost, (dates) =>
    dates.reduce<string | null>(
      (latest, d) => (d && (!latest || d > latest) ? d : latest),
      null,
    ),
  );
}
