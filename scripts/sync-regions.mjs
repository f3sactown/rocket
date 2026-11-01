#!/usr/bin/env node
/**
 * Nightly region sync (run by .github/workflows/sync-regions.yml).
 *
 * For each region in Supabase, reads its Google Sheet through Google's Visualization API and saves
 * a compact copy: active AOs with addresses, roster names, each AO's regulars over the last few
 * months, and every PAX's total posts and Qs. The app reads that copy instead of the sheet.
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The sheets must be shared so anyone with the
 * link can view them. SHEETS_BASE overrides the Google address (for tests).
 */

const REGULARS_MONTHS = 3;
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

async function supabase(path, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
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

function unique(items, key) {
  const seen = new Map();
  for (const item of items) if (!seen.has(key(item))) seen.set(key(item), item);
  return [...seen.values()];
}

async function readRegion({ sheet_id: id, config }) {
  // AOs (sites), leaving out retired ones.
  const { sheet: sitesTab, ...siteNames } = config.sites;
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
        address: [s.location, s.address].filter(Boolean).join(" - "),
        day: s.day ?? "",
        time: s.time ?? "",
      })),
    (s) => s.name.toLowerCase(),
  );

  // Roster names.
  const rosterCols = await columns(id, config.roster.sheet, {
    name: config.roster.name,
  });
  const roster = unique(
    (await query(id, config.roster.sheet, `select ${rosterCols.name}`)).rows
      .map((row) => ({ name: text(row[0]) }))
      .filter((r) => r.name),
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
        `select ${att.ao}, ${att.pax}, count(${att.pax}) where ${att.date} >= date '${since.toISOString().slice(0, 10)}' group by ${att.ao}, ${att.pax}`,
      )
    ).rows
      .map((row) => ({
        ao: text(row[0]),
        pax: text(row[1]),
        posts: Number(row[2]) || 0,
      }))
      .filter((r) => r.ao && r.pax),
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
      .filter((s) => s.pax),
    (s) => s.pax,
  );

  return { sites, roster, regulars, stats };
}

const regions = await supabase(
  "regions?select=id,name,sheet_id,config&order=name",
);
let failures = 0;
for (const region of regions) {
  try {
    const data = await readRegion(region);
    await supabase("rpc/replace_region_data", {
      p_region: region.id,
      p_sites: data.sites,
      p_roster: data.roster,
      p_regulars: data.regulars,
      p_stats: data.stats,
    });
    console.log(
      `${region.name}: ${data.sites.length} AOs, ${data.roster.length} PAX, ${data.regulars.length} regulars, ${data.stats.length} totals`,
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
// Fail the run only when nothing could be synced, so one broken custom region doesn't mark every
// night red; its error is shown in that region's Settings.
if (regions.length > 0 && failures === regions.length) process.exit(1);
