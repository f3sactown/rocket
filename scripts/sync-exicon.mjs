// Copies the exercise and routine Library into Supabase, once a week, from two sources:
//   - F3: F3 Nation's Exicon on the F3 Codex (the list its Exicon page loads).
//   - FiA: FiA's Exicon ("Updated FiA Exicon"), a Google Sheet shared so anyone with the link
//     can view it.
// Runs in GitHub Actions (.github/workflows/sync-exicon.yml) with the service-role key, which can
// replace the read-only `exicon_entries` table. Each source is replaced on its own, so one failing
// leaves the other (and its own previous copy) in place.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/sync-exicon.mjs
//
// EXICON_URL and SHEETS_BASE override where the lists are read from (for tests).

const SUPABASE_URL = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).origin
  : "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EXICON_URL =
  process.env.EXICON_URL ?? "https://codex.f3nation.com/api/exicon";
const CODEX = "https://codex.f3nation.com";
const SHEETS_BASE = process.env.SHEETS_BASE || "https://docs.google.com";
/**
 * FiA's Exicon ("Updated FiA Exicon"). Its "FiA Nation Alphabetical" tab has no header row: each
 * row is a name, a category or focus (e.g. "Arms/Shoulders", "Routine", "Term") and a description.
 */
const FIA_SHEET = "1twkcFAxUQHbKCQBnQSFxqMOKJ7kOXsDoQcJQsW37Efg";
const FIA_TAB = "FiA Nation Alphabetical";
const FIA_URL = `https://docs.google.com/spreadsheets/d/${FIA_SHEET}/edit`;

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#")
      return String.fromCodePoint(
        code[1].toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : Number(code.slice(1)),
      );
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/**
 * The Codex's formatted HTML description as plain text: paragraphs separated by blank lines,
 * bulleted ("- ") and numbered ("1. ") list items one per line.
 */
export function htmlToText(html) {
  const lists = []; // A stack of { ordered, count } for nested lists.
  let out = "";
  const newline = (blank) => {
    out = out.replace(/[ \t]+$/, "");
    if (!out) return;
    const want = blank && !lists.length ? "\n\n" : "\n";
    if (!out.endsWith(want)) out = out.replace(/\n*$/, "") + want;
  };
  for (const part of String(html ?? "").split(/(<[^>]+>)/)) {
    const tag = /^<(\/?)([a-z0-9]+)/i.exec(part);
    if (!tag) {
      out += decode(part).replace(/\s+/g, " ");
      continue;
    }
    const [, closing, nameRaw] = tag;
    const name = nameRaw.toLowerCase();
    if (name === "br") newline(false);
    else if (name === "ul" || name === "ol") {
      if (closing) {
        lists.pop();
        newline(true);
      } else {
        newline(false);
        lists.push({ ordered: name === "ol", count: 0 });
      }
    } else if (name === "li" && !closing) {
      newline(false);
      const list = lists[lists.length - 1];
      out += list?.ordered ? `${++list.count}. ` : "- ";
    } else if (/^(p|div|h[1-6])$/.test(name) && closing) newline(true);
  }
  return out
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/^(- |\d+\. )\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const names = (list) =>
  (Array.isArray(list) ? list : [])
    .map((item) => (typeof item === "string" ? item : item?.name))
    .filter((name) => typeof name === "string" && name.trim())
    .map((name) => name.trim());

/** Replaces one source's entries in Supabase. */
async function save(source, entries) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/replace_exicon_entries`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_source: source, p_entries: entries }),
    },
  );
  if (!response.ok)
    throw new Error(`Supabase: ${response.status} ${await response.text()}`);
}

/** Refuses a list too short to be real, so a broken read doesn't wipe the library. */
function enough(entries, minimum, source) {
  if (entries.length < minimum)
    throw new Error(
      `Only ${entries.length} ${source} entries came back; keeping the current library.`,
    );
  return entries;
}

function summary(entries) {
  const routines = entries.filter((e) => e.is_routine).length;
  return `${entries.length} entries (${entries.length - routines} exercises, ${routines} routines)`;
}

/** F3 Nation's Exicon, from the F3 Codex. */
export async function readF3() {
  const response = await fetch(EXICON_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Rocket (rocket.f3sactown.com) weekly Exicon sync",
    },
  });
  if (!response.ok)
    throw new Error(
      `Couldn't read the F3 Exicon: ${response.status} ${EXICON_URL}`,
    );
  const raw = await response.json();
  const list = Array.isArray(raw) ? raw : (raw.entries ?? raw.data ?? []);
  const seen = new Set();
  const entries = list
    .filter((e) => e && typeof e.id === "string" && typeof e.name === "string")
    .filter((e) => !seen.has(e.id) && seen.add(e.id))
    .map((e) => {
      const tags = names(e.tags);
      return {
        id: e.id,
        name: e.name.trim(),
        description: htmlToText(e.description),
        aliases: names(e.aliases),
        tags,
        is_routine: tags.some((t) => t.toLowerCase() === "routine"),
        video_url: /^https?:\/\//i.test(e.videoLink ?? "") ? e.videoLink : "",
        url: `${CODEX}/exicon/${encodeURIComponent(e.id)}`,
      };
    });
  return enough(entries, 50, "F3");
}

/**
 * Reads every row of a sheet tab with Google's Visualization API: keyed by column header, or (for
 * a tab with no header row, `headers` 0) as plain arrays of cell values.
 */
async function readTab(sheetId, tab, headers = 1) {
  const params = new URLSearchParams({
    tqx: "out:json",
    headers: String(headers),
    sheet: tab,
    tq: "select *",
  });
  const response = await fetch(
    `${SHEETS_BASE}/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?${params}`,
  );
  const text = await response.text();
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  if (!response.ok || start < 0 || end < start)
    throw new Error(
      `Couldn't read the "${tab}" tab of the FiA Exicon. Make sure the sheet is shared so anyone with the link can view it.`,
    );
  const result = JSON.parse(text.slice(start + 1, end));
  if (result.status === "error")
    throw new Error(
      result.errors?.[0]?.detailed_message ?? "FiA Exicon query failed",
    );
  if (!headers)
    return result.table.rows.map((row) =>
      result.table.cols.map((_, i) => String(row.c?.[i]?.v ?? "").trim()),
    );
  const labels = result.table.cols.map((col) =>
    String(col.label ?? "")
      .trim()
      .toLowerCase(),
  );
  return result.table.rows.map((row) =>
    Object.fromEntries(
      labels.map((label, i) => [label, String(row.c?.[i]?.v ?? "").trim()]),
    ),
  );
}

/** A name on one line: "Jumping Jack Toe Touch\n(JJTT)" becomes "Jumping Jack Toe Touch (JJTT)". */
const oneLine = (text) => text.replace(/\s+/g, " ").trim();

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** FiA focus words, as F3's tag names where they mean the same thing. */
const FIA_TAG_NAMES = [
  [/^abs?$/, "Core"],
  [/^warm|^wamup/, "Warm-Up"],
  [/^full[- ]?body$/, "Full Body"],
  [/^cool/, "Cooldown"],
];

/**
 * Tags for a FiA category such as "Arms/Shoulders", "Routine/Full-body" or "Partner Routine":
 * each part becomes a tag, using F3's tag names where they mean the same thing ("Abs" is Core).
 * "Exercise" adds none. Returns null for a Term (vocabulary, not an exercise), which is left out.
 */
export function fiaTags(category) {
  const c = category.toLowerCase().trim();
  if (!c || c === "term") return null;
  const tags = [];
  for (const part of c.split(/[/,&]|\s+(?=routine)/)) {
    const word = part.trim();
    if (!word || word === "exercise") continue;
    const known = FIA_TAG_NAMES.find(([pattern]) => pattern.test(word));
    tags.push(
      known
        ? known[1]
        : word.replace(/(^|[\s-])([a-z])/g, (m) => m.toUpperCase()),
    );
  }
  return [...new Set(tags)];
}

/** FiA's Exicon, from its Google Sheet. */
export async function readFia() {
  const entries = new Map();
  const add = (name, description, tags) => {
    // Some names end in "*" in the sheet; it isn't part of the name.
    const clean = oneLine(name).replace(/\s*\*+$/, "");
    const id = `fia-${slug(clean)}`;
    if (!clean || !slug(clean) || entries.has(id)) return;
    entries.set(id, {
      id,
      name: clean,
      description: description.trim(),
      aliases: [],
      tags,
      is_routine: tags.includes("Routine"),
      video_url: "",
      url: FIA_URL,
    });
  };
  for (const [name = "", category = "", description = ""] of await readTab(
    FIA_SHEET,
    FIA_TAB,
    0,
  )) {
    const tags = fiaTags(category);
    if (tags) add(name, description, tags);
  }
  return enough([...entries.values()], 100, "FiA");
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY)
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run the Exicon sync.",
    );
  let failures = 0;
  for (const [source, label, read] of [
    ["f3", "F3", readF3],
    ["fia", "FiA", readFia],
  ]) {
    try {
      const entries = await read();
      await save(source, entries);
      console.log(`${label}: synced ${summary(entries)}.`);
    } catch (error) {
      failures++;
      console.log(`::error::${label}: ${error.message}`);
    }
  }
  // Fail the run when either source failed, so it shows red; the other one still synced.
  if (failures) process.exit(1);
}

// Run when called directly (not when imported by a test).
if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    console.log(`::error::${error.message}`);
    process.exit(1);
  });
