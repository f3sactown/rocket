// Copies F3 Nation's Exicon (exercises and routines) from the F3 Codex into Supabase, once a week.
// Runs in GitHub Actions (.github/workflows/sync-exicon.yml) with the service-role key, which can
// replace the read-only `exicon_entries` table. The Codex's own Exicon page loads the same list.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/sync-exicon.mjs
//
// EXICON_URL overrides where the list is read from (for tests).

const SUPABASE_URL = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).origin
  : "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EXICON_URL =
  process.env.EXICON_URL ?? "https://codex.f3nation.com/api/exicon";
const CODEX = "https://codex.f3nation.com";

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

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY)
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run the Exicon sync.",
    );
  const response = await fetch(EXICON_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Rocket (rocket.f3sactown.com) weekly Exicon sync",
    },
  });
  if (!response.ok)
    throw new Error(
      `Couldn't read the Exicon: ${response.status} ${EXICON_URL}`,
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
  // A broken or empty response shouldn't wipe out last week's library.
  if (entries.length < 50)
    throw new Error(
      `Only ${entries.length} entries came back; keeping the current library.`,
    );

  const save = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/replace_exicon_entries`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_entries: entries }),
    },
  );
  if (!save.ok)
    throw new Error(`Supabase: ${save.status} ${await save.text()}`);
  const routines = entries.filter((e) => e.is_routine).length;
  console.log(
    `Synced ${entries.length} Exicon entries (${entries.length - routines} exercises, ${routines} routines).`,
  );
}

// Run when called directly (not when imported by a test).
if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    console.log(`::error::${error.message}`);
    process.exit(1);
  });
