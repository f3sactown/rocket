#!/usr/bin/env node
/**
 * Nightly region sync (run by .github/workflows/sync-regions.yml).
 *
 * For each region in Supabase, reads its Google Sheet through Google's Visualization API and saves
 * a compact copy: active AOs with addresses, roster names, each AO's regulars over the last few
 * months, and every PAX's total posts and Qs. The app reads that copy instead of the sheet.
 *
 * Then it looks up where each AO is for its weather, once per address: its street address (from
 * the tab's Address column when it has one) with the US Census geocoder, else its place's name in
 * its city (the tab's City column) with OpenStreetMap's Nominatim, else the city itself; kept in
 * place_coordinates. One that can't be found is tried again after 30 days.
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The sheets must be shared so anyone with the
 * link can view them. SHEETS_BASE overrides the Google address (for tests).
 */

const REGULARS_MONTHS = 3;

/**
 * A name in the PAX column left out rather than synced as a PAX: a placeholder such as "Site Closed
 * (Archived)" marking when an AO stopped meeting, or a PAX marked retired, e.g. "007 (Retired)"
 * or a sheet's "last updated" note, e.g. "UPDATED 1/8/2025" (the same rule as isPlaceholderPax in
 * @rocket/core).
 */
function isPlaceholderPax(name) {
  return (
    /\bsite\s*closed\b/i.test(name) ||
    /\(\s*retired\s*\)/i.test(name) ||
    /^\s*updated\b.*\d/i.test(name)
  );
}

/**
 * Tomorrow (YYYY-MM-DD): no post is later than that, so a row dated after it is a sheet's note kept
 * at the top (e.g. dated 1/1/2099), not a post.
 */
function lastPostDate() {
  const day = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return day.toISOString().slice(0, 10);
}
const SHEETS_BASE = process.env.SHEETS_BASE || "https://docs.google.com";
const SUPABASE_URL = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL.trim()).origin
  : "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "::error::Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run the region sync.",
  );
  process.exit(1);
}

async function supabase(path, body, method, headers = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(
      `Supabase ${path}: ${response.status} ${await response.text()}`,
    );
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/** Runs a Visualization API query against one tab and returns { cols, rows } of plain values. */
async function query(sheetId, tab, tq) {
  const params = new URLSearchParams({
    tqx: "out:json",
    headers: "1",
    sheet: tab,
    tq,
  });
  const response = await fetch(
    `${SHEETS_BASE}/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?${params}`,
  );
  const text = await response.text();
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  if (!response.ok || start < 0 || end < start)
    throw new Error(
      `Couldn't read the "${tab}" tab. Make sure the sheet is shared so anyone with the link can view it.`,
    );
  const result = JSON.parse(text.slice(start + 1, end));
  if (result.status === "error") {
    const error = result.errors?.[0];
    throw new Error(
      error?.detailed_message || error?.message || "Sheet query failed",
    );
  }
  return {
    cols: result.table.cols,
    rows: result.table.rows.map((row) =>
      row.c.map((cell) =>
        cell?.v === null || cell?.v === undefined ? "" : cell.v,
      ),
    ),
  };
}

const text = (value) => String(value ?? "").trim();

/** A sheet date as YYYY-MM-DD: the API sends dates as "Date(2026,9,31)", with months from 0. */
function sheetDate(value) {
  const match = /^Date\((\d+),(\d+),(\d+)/.exec(text(value));
  if (match)
    return `${match[1]}-${String(Number(match[2]) + 1).padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(text(value))
    ? text(value).slice(0, 10)
    : null;
}
const quote = (s) => (s.includes('"') ? `'${s}'` : `"${s}"`);

/** Column letters for header names in a tab; throws naming any that are missing. */
async function columns(sheetId, tab, names) {
  const { cols } = await query(sheetId, tab, "select * limit 0");
  const byLabel = new Map(
    cols.map((c) => [c.label.trim().toLowerCase(), c.id]),
  );
  const result = {};
  const missing = [];
  for (const [key, name] of Object.entries(names)) {
    if (!name?.trim()) continue;
    const id = byLabel.get(name.trim().toLowerCase());
    if (id) result[key] = id;
    else missing.push(`"${name}"`);
  }
  if (missing.length)
    throw new Error(`Couldn't find ${missing.join(", ")} in the "${tab}" tab.`);
  return result;
}

/** Whether a tab has a column with this header. */
async function hasColumn(sheetId, tab, name) {
  const { cols } = await query(sheetId, tab, "select * limit 0");
  return cols.some((c) => c.label.trim().toLowerCase() === name.toLowerCase());
}

function unique(items, key) {
  const seen = new Map();
  for (const item of items) if (!seen.has(key(item))) seen.set(key(item), item);
  return [...seen.values()];
}

async function readRegion({ sheet_id: id, config }) {
  // AOs (sites), leaving out retired ones.
  const { sheet: sitesTab, ...siteNames } = config.sites;
  // The AO's city, when the tab has a City column: it's what places a park's name on the map.
  const cityColumn = config.sites.city ?? "City";
  if (!("city" in config.sites) && !(await hasColumn(id, sitesTab, cityColumn)))
    delete siteNames.city;
  else siteNames.city = cityColumn;
  const siteCols = await columns(id, sitesTab, siteNames);
  const siteKeys = Object.keys(siteCols);
  const siteRows = (
    await query(
      id,
      sitesTab,
      `select ${siteKeys.map((k) => siteCols[k]).join(", ")}`,
    )
  ).rows.map((row) =>
    Object.fromEntries(siteKeys.map((k, i) => [k, text(row[i])])),
  );
  const sites = unique(
    siteRows
      .filter((s) => s.ao && !/^(y|yes|true|x)$/i.test(s.retired ?? ""))
      .map((s) => ({
        name: s.ao,
        address: s.location || s.address,
        day: s.day ?? "",
        time: s.time ?? "",
      })),
    (s) => s.name.toLowerCase(),
  );
  // What finds each AO on the map, by the address it's shown with (not saved with the AO): its
  // street address when the tab has one besides the place's name, and its city.
  const places = new Map(
    siteRows
      .filter((s) => s.location || s.address)
      .map((s) => [
        (s.location || s.address).trim(),
        {
          street: s.location && s.address ? s.address.trim() : "",
          city: s.city?.trim() ?? "",
        },
      ]),
  );

  // Roster names, leaving out placeholders such as "Site Closed (Archived)".
  const rosterCols = await columns(id, config.roster.sheet, {
    name: config.roster.name,
  });
  const roster = unique(
    (await query(id, config.roster.sheet, `select ${rosterCols.name}`)).rows
      .map((row) => ({ name: text(row[0]) }))
      .filter((r) => r.name && !isPlaceholderPax(r.name)),
    (r) => r.name.toLowerCase(),
  );

  // Attendance: regulars per AO recently, and all-time totals per PAX (summed by Google).
  const a = config.attendance;
  const att = await columns(id, a.sheet, {
    date: a.date,
    ao: a.ao,
    pax: a.pax,
    post: a.post,
    q: a.q,
  });
  const since = new Date();
  since.setMonth(since.getMonth() - REGULARS_MONTHS);
  const regulars = unique(
    (
      await query(
        id,
        a.sheet,
        `select ${att.ao}, ${att.pax}, count(${att.pax}) where ${att.date} >= date '${since.toISOString().slice(0, 10)}' and ${att.date} <= date '${lastPostDate()}' group by ${att.ao}, ${att.pax}`,
      )
    ).rows
      .map((row) => ({
        ao: text(row[0]),
        pax: text(row[1]),
        posts: Number(row[2]) || 0,
      }))
      .filter((r) => r.ao && r.pax && !isPlaceholderPax(r.pax)),
    (r) => `${r.ao}\u0000${r.pax}`,
  );
  const stats = unique(
    (
      await query(
        id,
        a.sheet,
        `select ${att.pax}, sum(${att.post}), sum(${att.q}) group by ${att.pax}`,
      )
    ).rows
      .map((row) => ({
        pax: text(row[0]),
        posts: Math.round(Number(row[1]) || 0),
        qs: Math.round(Number(row[2]) || 0),
      }))
      .filter((s) => s.pax && !isPlaceholderPax(s.pax)),
    (s) => s.pax,
  );

  // The newest post date, to show how current the sheet is (a note dated in the future isn't one).
  const latest = await query(
    id,
    a.sheet,
    `select max(${att.date}) where ${att.date} <= date '${lastPostDate()}'`,
  );
  const latestPostOn = sheetDate(latest.rows[0]?.[0]);

  return {
    places,
    sites,
    roster,
    regulars,
    stats,
    latestPostOn,
  };
}

/**
 * The region's own exercises and routines, from an optional "Exicon" tab with Name, Category,
 * Tags, Description and Author columns. The author goes at the end of the description in
 * parentheses. Returns null when the region has no such tab (or it lacks Name and Description).
 */
export async function readRegionExicon({ id: regionId, sheet_id: id, config }) {
  const tab = config.exicon?.sheet || "Exicon";
  let cols;
  try {
    cols = await columns(id, tab, { name: "Name", description: "Description" });
  } catch {
    return null;
  }
  const optional = {};
  for (const [key, name] of Object.entries({
    category: "Category",
    tags: "Tags",
    author: "Author",
  })) {
    try {
      Object.assign(optional, await columns(id, tab, { [key]: name }));
    } catch {
      // That column is optional.
    }
  }
  const all = { ...cols, ...optional };
  const keys = Object.keys(all);
  const rows = (
    await query(id, tab, `select ${keys.map((k) => all[k]).join(", ")}`)
  ).rows.map((row) =>
    Object.fromEntries(keys.map((k, i) => [k, text(row[i])])),
  );
  const url = `https://docs.google.com/spreadsheets/d/${id}/edit`;
  const entries = [];
  for (const row of rows) {
    if (!row.name) continue;
    const category = row.category ?? "";
    const isRoutine = /routine/i.test(category);
    const tags = [
      ...(row.tags ?? "").split(/[,;]/),
      // The category is a tag too, unless it only says exercise or routine.
      /^(exercises?|routines?)$/i.test(category) ? "" : category,
    ]
      .map((t) => t.trim())
      .filter(Boolean);
    const description = [row.description, row.author && `(${row.author})`]
      .filter(Boolean)
      .join(" ");
    entries.push({
      id: `region-${regionId}-${entries.length}`,
      name: row.name,
      description,
      tags: [...new Set(tags)],
      is_routine: isRoutine,
      url,
    });
  }
  return entries;
}

/** An address as place_coordinates keys it (the same as placeKey in _shared/weather.ts). */
const placeKey = (address) => address.trim().replace(/\s+/g, " ").toLowerCase();

/** The street address after a place's name, if it has one (as streetAddress in _shared/weather.ts). */
function streetAddress(address) {
  const parts = address.split(/\s+[-–—]\s+/).map((p) => p.trim());
  const street = [...parts].reverse().find((p) => /\d/.test(p) && /,/.test(p));
  return (street ?? address).trim();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Where an address is, from the US Census geocoder (street addresses), or null. */
async function censusLookup(address) {
  const params = new URLSearchParams({
    address,
    benchmark: "Public_AR_Current",
    format: "json",
  });
  const response = await fetch(
    `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params}`,
  );
  if (!response.ok) return null;
  const match = (await response.json())?.result?.addressMatches?.[0];
  const { x, y } = match?.coordinates ?? {};
  return typeof x === "number" && typeof y === "number"
    ? { latitude: y, longitude: x }
    : null;
}

/** Where a place is, from OpenStreetMap (parks and other named places), or null. */
async function osmLookup(place) {
  // Nominatim asks for no more than one request a second, from a named app.
  await sleep(1100);
  const params = new URLSearchParams({
    q: place,
    format: "jsonv2",
    limit: "1",
    countrycodes: "us",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { "User-Agent": "Rocket F3 Q planner, AO weather lookup" } },
  );
  if (!response.ok) return null;
  const [found] = await response.json();
  const latitude = Number(found?.lat);
  const longitude = Number(found?.lon);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

/** The most addresses looked up in one run (the rest wait for the next night). */
const MOST_LOOKUPS = 150;
/** How long before an address that couldn't be found is tried again. */
const RETRY_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Lookups made before this used a park's name alone, which can land in another state (Oak Meadow
 * Park, Sacramento was found in Wisconsin); those are looked up again once with the AO's city.
 */
const LOOKUPS_SINCE = Date.parse("2026-11-25T00:00:00Z");

/**
 * Where an AO is: a street address (the sheet's own, beside the place's name) from the Census
 * geocoder; otherwise its place's name in its city from OpenStreetMap, or failing that the city
 * itself (near enough for the weather). With no city known, the place's name alone.
 */
async function locate(address, city, fullStreet) {
  if (fullStreet && /\d/.test(fullStreet) && /,/.test(fullStreet)) {
    const found = await censusLookup(fullStreet);
    if (found) return found;
  }
  const street = streetAddress(address);
  const inCity = city && !street.toLowerCase().includes(city.toLowerCase());
  return (
    (/\d/.test(street) && /,/.test(street) && (await censusLookup(street))) ||
    (city
      ? (await osmLookup(inCity ? `${street}, ${city}` : street)) ||
        (await osmLookup(city))
      : (await osmLookup(street)) ||
        (street !== address ? await osmLookup(address) : null))
  );
}

/** Looks up where every AO is that isn't known yet, for its weather. */
async function locateSites(addresses) {
  const known = new Map(
    (
      await supabase("place_coordinates?select=address,latitude,looked_up_at")
    ).map((p) => [p.address, p]),
  );
  const wanted = [...addresses.entries()].filter(([key]) => {
    const kept = known.get(key);
    return (
      !kept ||
      Date.parse(kept.looked_up_at) < LOOKUPS_SINCE ||
      (kept.latitude === null &&
        Date.now() - Date.parse(kept.looked_up_at) > RETRY_MS)
    );
  });
  let found = 0;
  for (const [key, { address, city, street }] of wanted.slice(
    0,
    MOST_LOOKUPS,
  )) {
    let place = null;
    try {
      place = await locate(address, city, street);
    } catch (error) {
      console.log(`::warning::Couldn't look up "${address}": ${error.message}`);
      continue;
    }
    if (place) found++;
    await supabase(
      "place_coordinates",
      {
        address: key,
        latitude: place?.latitude ?? null,
        longitude: place?.longitude ?? null,
        looked_up_at: new Date().toISOString(),
      },
      "POST",
      { Prefer: "resolution=merge-duplicates" },
    );
  }
  console.log(
    `AO locations: ${addresses.size} AOs, ${wanted.length} to look up, found ${found} of ${Math.min(wanted.length, MOST_LOOKUPS)}.`,
  );
}

const regions = await supabase(
  "regions?select=id,name,sheet_id,config&order=name",
);
let failures = 0;
/** Every AO's address and city, by its key, for looking up where they are. */
const siteAddresses = new Map();
for (const region of regions) {
  try {
    const data = await readRegion(region);
    for (const site of data.sites)
      if (site.address?.trim())
        siteAddresses.set(placeKey(site.address), {
          address: site.address.trim(),
          ...data.places.get(site.address.trim()),
        });
    await supabase("rpc/replace_region_data", {
      p_region: region.id,
      p_sites: data.sites,
      p_roster: data.roster,
      p_regulars: data.regulars,
      p_stats: data.stats,
    });
    await supabase(
      `regions?id=eq.${region.id}`,
      { latest_post_on: data.latestPostOn },
      "PATCH",
    );
    // The region's own Exicon is optional; a problem with it doesn't fail the region's sync.
    let exicon = "no Exicon tab";
    try {
      const entries = await readRegionExicon(region);
      if (entries) {
        await supabase("rpc/replace_region_exicon", {
          p_region: region.id,
          p_entries: entries,
        });
        exicon = `${entries.length} Exicon entries`;
      }
    } catch (error) {
      exicon = `Exicon not read (${error.message})`;
      console.log(`::warning::${region.name}: ${exicon}`);
    }
    console.log(
      `${region.name}: ${exicon}, ${data.sites.length} AOs, ${data.roster.length} PAX, ${data.regulars.length} regulars, ${data.stats.length} totals, latest post ${data.latestPostOn ?? "none"}`,
    );
  } catch (error) {
    failures++;
    console.log(`::warning::${region.name}: ${error.message}`);
    await supabase("rpc/record_region_sync_error", {
      p_region: region.id,
      p_error: error.message.slice(0, 500),
    }).catch(() => {});
  }
}

console.log(
  `Synced ${regions.length - failures} of ${regions.length} regions.`,
);
// Where the AOs are, for their weather. A problem here doesn't fail the sync.
try {
  await locateSites(siteAddresses);
} catch (error) {
  console.log(`::warning::AO locations not looked up: ${error.message}`);
}
// Fail the run only when nothing could be synced, so one broken custom region doesn't mark every
// night red; its error is shown in that region's Settings.
if (regions.length > 0 && failures === regions.length) process.exit(1);
