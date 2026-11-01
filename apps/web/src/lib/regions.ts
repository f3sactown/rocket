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
  /** When the nightly sync last copied the sheet into Supabase; null until the first sync. */
  synced_at: string | null;
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
          "id, name, sheet_id, language, config, created_by, synced_at, sync_error",
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
        address: [get(row, "location"), get(row, "address")]
          .filter(Boolean)
          .join(" - "),
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
