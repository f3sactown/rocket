/* F3 Q Planner — plan workouts, write backblasts, browse the Exicon.
   Everything is stored in this browser (localStorage). No server needed. */
"use strict";

const APP_VERSION = "1.0.0";
const LS_PREFIX = "f3qp:";

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); }
    catch (e) { console.warn("Save failed", e); toast("Couldn't save — browser storage is full or blocked"); }
  },
};

const DEFAULT_SETTINGS = {
  regionName: "My Region",
  logo: "",
  f3Name: "",
  homeAoId: "",
  defaultWhy: "get 1% better",
  openingTemplate: "{count} HIM met at {ao} today to {why}.",
  ignoreProgram: false,
  runTextSize: "large",
  libraryHiddenSources: [],
  region: "",            // "sactown" (a built-in region), "custom" (the user's own sheet) or "none"
  customSheetUrl: "",
  customRegionName: "",   // every source is on unless the user turns it off, including ones added later
};

const COLLECTIONS = ["aos", "templates", "workouts", "backblasts"];
const state = {
  settings: { ...DEFAULT_SETTINGS, ...store.get("settings", {}) },
  roster: store.get("roster", []),
  aos: store.get("aos", []),
  templates: store.get("templates", []),
  workouts: store.get("workouts", []),
  backblasts: store.get("backblasts", []),
  program: { version: "", removed: [], hashes: {}, notice: null, rosterAdded: [], ...store.get("program", {}) },
};
function save(...keys) { keys.forEach(k => store.set(k, state[k])); }

/* ------------------------------------------------------------------ */
/* Region data: AOs, PAX roster and attendance from a region's sheet   */
/* ------------------------------------------------------------------ */
/** Built-in regions. Their data ships with the app (refreshed weekly by GitHub Actions):
 *  AOs come from program content, the roster from data/roster.js, attendance from data/attendance.js. */
const REGIONS = [
  { key: "sactown", name: "F3 SacTown", sheet: "https://docs.google.com/spreadsheets/d/1_R4F0syR4m7eBen4j92PJCFeGrxEvNrbrL7LxFG46So/edit" },
];
const REGION_REFRESH_HOURS = 6;     // how often a custom sheet is re-read
const ATTENDANCE_KEEP_DAYS = 180;
let regionCache = store.get("regionCache", null);  // custom sheet data: { sheetId, fetchedAt, aos, roster, attendance, error }

function regionKey() { return state.settings.region || "none"; }
/** True once the user has a real region name (picked a region or typed one), not the placeholder. */
const OLD_DEFAULT_REGION_NAME = "F3 My Region";  // the placeholder before it lost its "F3"
function regionNameSet() { const n = (state.settings.regionName || "").trim(); return !!n && n !== DEFAULT_SETTINGS.regionName && n !== OLD_DEFAULT_REGION_NAME; }
function builtInRegion() { return REGIONS.find(r => r.key === regionKey()) || null; }
function sheetIdFromUrl(url) { return String(url || "").match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/)?.[1] || ""; }
function customCache() {
  const id = sheetIdFromUrl(state.settings.customSheetUrl);
  return regionKey() === "custom" && id && regionCache?.sheetId === id ? regionCache : null;
}
/** Same rule as the region roster: leave out names with parentheses unless the only one is "(2.0)". */
function keepPaxName(name) { return (String(name).match(/\([^)]*\)?/g) || []).every(g => g.replace(/\s/g, "") === "(2.0)"); }
function regionRosterNames() {
  if (builtInRegion()?.key === "sactown") return window.F3_ROSTER?.names || [];
  return customCache()?.roster || [];
}
/** All-time [posts, Qs] for a PAX name in the region's data, or null if the name isn't there. */
function regionTotals(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  const totals = builtInRegion()?.key === "sactown" ? window.F3_ATTENDANCE?.totals : customCache()?.totals;
  const key = totals && Object.keys(totals).find(k => k.toLowerCase() === n);
  return key ? totals[key] : null;
}
function regionAttendance() {
  if (builtInRegion()?.key === "sactown") return window.F3_ATTENDANCE?.aos || {};
  return customCache()?.attendance || {};
}

/** Add the region's roster to this device's PAX roster. Each name is added once per region: a name
 *  the user later removes from their roster isn't added back. */
function syncRoster() {
  const key = regionKey();
  const p = state.program;
  if (!p.rosterAddedBy || typeof p.rosterAddedBy !== "object") p.rosterAddedBy = {};
  if (Array.isArray(p.rosterAdded)) { p.rosterAddedBy.sactown = [...(p.rosterAddedBy.sactown || []), ...p.rosterAdded]; delete p.rosterAdded; save("program"); }
  const names = regionRosterNames();
  if (!names.length) return 0;
  const doneList = p.rosterAddedBy[key] ||= [];
  const done = new Set(doneList.map(n => n.toLowerCase()));
  const fresh = names.filter(n => n && !done.has(n.toLowerCase()));
  if (!fresh.length) return 0;
  const have = new Set(state.roster.map(n => n.toLowerCase()));
  const add = fresh.filter(n => !have.has(n.toLowerCase()));
  if (add.length) { state.roster = uniqNames([...state.roster, ...add]).sort((a, b) => a.localeCompare(b)); save("roster"); }
  doneList.push(...fresh); save("program");
  return add.length;
}

/** Custom region AOs (from the sheet's Sites tab) live in state.aos with source "region".
 *  Unedited ones follow the sheet; ones the user deleted stay deleted. */
function syncRegionAos() {
  const want = customCache()?.aos || [];
  const removed = state.program.removed;
  let changed = false;
  const ids = new Set(want.map(a => a.id));
  const keep = state.aos.filter(a => a.source !== "region" || ids.has(a.id));
  if (keep.length !== state.aos.length) { state.aos = keep; changed = true; }
  for (const raw of want) {
    if (removed.includes(raw.id)) continue;
    const i = state.aos.findIndex(a => a.id === raw.id);
    if (i === -1) { state.aos.push({ ...raw, source: "region", createdAt: nowIso(), updatedAt: nowIso() }); changed = true; }
    else if (state.aos[i].source === "region" && ["name", "location", "address", "schedule"].some(k => state.aos[i][k] !== raw[k])) {
      Object.assign(state.aos[i], raw, { updatedAt: nowIso() }); changed = true;
    }
  }
  if (changed) save("aos");
  return changed;
}

/** Switch region: take away what the old region added (unedited AOs, roster names it added),
 *  then bring in the new region's AOs and roster. */
async function setRegion(next) {
  const s = state.settings, prev = regionKey();
  if (next === prev) return;
  const p = state.program;
  const added = new Set((p.rosterAddedBy?.[prev] || []).map(n => n.toLowerCase()));
  if (added.size) { state.roster = state.roster.filter(n => !added.has(n.toLowerCase())); delete p.rosterAddedBy[prev]; save("roster", "program"); }
  if (prev === "sactown") state.aos = state.aos.filter(a => a.source !== "program");
  if (prev === "custom") state.aos = state.aos.filter(a => a.source !== "region");
  if (!state.aos.some(a => a.id === s.homeAoId)) s.homeAoId = "";
  save("aos");
  const regionNames = [...REGIONS.map(r => r.name), s.customRegionName].filter(Boolean);
  if (next === "none" && regionNames.includes(s.regionName)) s.regionName = DEFAULT_SETTINGS.regionName;
  s.region = next;
  const built = REGIONS.find(r => r.key === next);
  if (built) s.regionName = built.name;
  else if (next === "custom" && s.customRegionName) s.regionName = s.customRegionName;
  save("settings");
  if (next === "sactown") await syncProgram({ force: true });
  if (next === "custom") await refreshCustomRegion({ force: true });
  syncRoster();
}

/* --- Reading a Google Sheet from the browser (gviz CSV endpoint, which allows cross-origin reads) --- */
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
async function sheetTab(id, tab, tq) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(tab)}${tq ? `&tq=${encodeURIComponent(tq)}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok || /^\s*</.test(text) || /google\.visualization\.Query/.test(text)) throw new Error("not-shared");
  const [head = [], ...rows] = parseCsv(text);
  const cols = head.map(h => h.trim().toLowerCase());
  return { cols, rows: rows.filter(r => r.some(c => c.trim())) };
}
const colLetter = i => (i >= 26 ? colLetter(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + (i % 26));
function sheetDate(raw) {
  const v = String(raw || "").trim();
  let m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; }
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}
const cleanName = s => String(s || "").replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

/** Read a region sheet laid out like the F3 SacTown Data sheet: tabs "Roster" (F3 Name),
 *  "Master Data" (Post Date, AO Name, PAX Name) and "Sites" (AO Name, Day, Location, Time, Address, Retired).
 *  Each tab is optional; a missing tab just means no data of that kind. */
async function readRegionSheet(id) {
  const out = { sheetId: id, fetchedAt: nowIso(), aos: [], roster: [], attendance: {}, totals: {}, missing: [] };
  const tryTab = async (tab, need, tq) => {
    try {
      const t = await sheetTab(id, tab, tq);
      if (need.every(n => t.cols.includes(n))) return t;
    } catch (e) { if (e.message === "not-shared") throw e; }
    out.missing.push(tab); return null;
  };
  const roster = await tryTab("Roster", ["f3 name"]);
  if (roster) {
    const i = roster.cols.indexOf("f3 name");
    out.roster = uniqNames(roster.rows.map(r => cleanName(r[i])).filter(n => n && keepPaxName(n))).sort((a, b) => a.localeCompare(b));
  }
  const sites = await tryTab("Sites", ["ao name"]);
  if (sites) {
    const c = n => sites.cols.indexOf(n), get = (r, n) => (c(n) >= 0 ? cleanName(r[c(n)]) : "");
    out.aos = sites.rows.filter(r => get(r, "ao name") && !/^(y|yes|true)$/i.test(get(r, "retired"))).map(r => ({
      id: `rg-${get(r, "ao name").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      name: get(r, "ao name"), location: get(r, "location"), address: get(r, "address"),
      schedule: [get(r, "day"), get(r, "time")].filter(Boolean).join(" "),
    }));
  }
  // Master Data can be long, so ask for the recent rows only (falls back to everything if the date column isn't a date).
  const since = new Date(Date.now() - ATTENDANCE_KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  const head = await tryTab("Master Data", ["post date", "ao name", "pax name"], "limit 0");
  if (head) {
    const [d, a, p] = ["post date", "ao name", "pax name"].map(n => head.cols.indexOf(n));
    let md;
    try { md = await sheetTab(id, "Master Data", `select ${colLetter(d)},${colLetter(a)},${colLetter(p)} where ${colLetter(d)} >= date '${since}'`); md.idx = [0, 1, 2]; }
    catch (e) { if (e.message === "not-shared") throw e; md = await sheetTab(id, "Master Data"); md.idx = [d, a, p]; }
    for (const r of md.rows) {
      const date = sheetDate(r[md.idx[0]]), ao = cleanName(r[md.idx[1]]), pax = cleanName(r[md.idx[2]]);
      if (!date || date < since || !ao || !pax || !keepPaxName(pax)) continue;
      const m = out.attendance[ao] ||= {};
      if (!m[pax] || m[pax] < date) m[pax] = date;
    }
    // All-time totals per PAX for "My stats": the sheet's running "Post Total"/"Q Total" (highest value), else sum of "Post"/"Q".
    const ci = n => head.cols.indexOf(n);
    const [pt, qt, po, qo] = ["post total", "q total", "post", "q"].map(ci);
    const agg = pt >= 0 && qt >= 0 ? `max(${colLetter(pt)}), max(${colLetter(qt)})` : po >= 0 && qo >= 0 ? `sum(${colLetter(po)}), sum(${colLetter(qo)})` : "";
    if (agg) {
      try {
        const t = await sheetTab(id, "Master Data", `select ${colLetter(p)}, ${agg} where ${colLetter(p)} is not null group by ${colLetter(p)}`);
        for (const r of t.rows) {
          const pax = cleanName(r[0]), posts = Math.round(Number(r[1]) || 0), qs = Math.round(Number(r[2]) || 0);
          if (pax && (posts || qs)) out.totals[pax] = [posts, qs];
        }
      } catch (e) { if (e.message === "not-shared") throw e; }
    }
  }
  return out;
}

/** Re-read the custom sheet when it's due (or forced), then apply its AOs and roster. */
let regionLoading = null;
function refreshCustomRegion(opts) {
  return regionLoading ||= loadCustomRegion(opts).finally(() => { regionLoading = null; });
}
async function loadCustomRegion({ force = false } = {}) {
  if (regionKey() !== "custom") return null;
  const id = sheetIdFromUrl(state.settings.customSheetUrl);
  if (!id) return null;
  const fresh = regionCache?.sheetId === id && regionCache.fetchedAt && Date.now() - Date.parse(regionCache.fetchedAt) < REGION_REFRESH_HOURS * 36e5;
  if (fresh && !force && !regionCache.error) { syncRegionAos(); return regionCache; }
  try {
    regionCache = await readRegionSheet(id);
  } catch (e) {
    const msg = e.message === "not-shared"
      ? "Couldn't read that sheet. In Google Sheets, click Share and set General access to “Anyone with the link” (Viewer)."
      : "Couldn't reach Google Sheets. Check your connection and try again.";
    regionCache = { ...(regionCache?.sheetId === id ? regionCache : { sheetId: id, aos: [], roster: [], attendance: {} }), error: msg };
  }
  store.set("regionCache", regionCache);
  syncRegionAos();
  syncRoster();
  return regionCache;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = (p = "u") => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nowIso = () => new Date().toISOString();
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(iso, opts = { weekday: "short", month: "short", day: "numeric", year: "numeric" }) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", opts);
}
function fmtWhen(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function debounce(fn, ms) {
  let t = null;
  const wrapped = () => { clearTimeout(t); t = setTimeout(() => { t = null; fn(); }, ms); };
  wrapped.flush = () => { if (t) { clearTimeout(t); t = null; fn(); } };
  wrapped.cancel = () => { clearTimeout(t); t = null; };
  return wrapped;
}
function isProgram(item) { return String(item?.source || "").startsWith("program"); }
function aoById(id) { return state.aos.find(a => a.id === id) || null; }
function aoName(id) { return aoById(id)?.name || ""; }
function uniqNames(list) {
  const seen = new Set();
  return list.map(s => String(s).trim()).filter(s => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied to clipboard"); return true; }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch {}
    ta.remove(); toast(ok ? "Copied to clipboard" : "Couldn't copy — select the text manually");
    return ok;
  }
}
async function shareText(title, text) {
  if (navigator.share) {
    try { await navigator.share({ title, text }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  copyText(text);
}

let toastTimer;
function toast(msg) {
  let el = $(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg; el.classList.remove("hidden");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add("hidden"), 2400);
}

/* ------------------------------------------------------------------ */
/* Modals                                                              */
/* ------------------------------------------------------------------ */
function openModal(html, bind) {
  const wrap = document.createElement("div");
  wrap.className = "modal-wrap";
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(wrap);
  document.body.style.overflow = "hidden";
  const close = () => { wrap.remove(); if (!$(".modal-wrap")) document.body.style.overflow = ""; };
  wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
  $$("[data-close]", wrap).forEach(b => b.addEventListener("click", close));
  bind?.(wrap, close);
  const first = $("input, textarea", wrap);
  if (first && !first.dataset.noautofocus) first.focus();
  return close;
}
function confirmModal(message, okLabel = "Confirm", danger = true) {
  return new Promise(resolve => {
    let done = false;
    const close = openModal(`
      <h2>Are you sure?</h2>
      <p class="muted">${esc(message)}</p>
      <div class="btn-row" style="margin-top:18px;justify-content:flex-end">
        <button class="btn" data-no>Cancel</button>
        <button class="btn ${danger ? "danger" : "primary"}" data-yes>${esc(okLabel)}</button>
      </div>`, (w, c) => {
      $("[data-no]", w).onclick = () => { done = true; c(); resolve(false); };
      $("[data-yes]", w).onclick = () => { done = true; c(); resolve(true); };
    });
    void close; void done;
  });
}

/* ------------------------------------------------------------------ */
/* Program content (ships with the app, updated with each release)     */
/* ------------------------------------------------------------------ */
const PROGRAM_COLLECTIONS = ["templates", "aos", "workouts"];
let programCache = null;

async function fetchProgram() {
  if (programCache) return programCache;
  if (!window.F3_PROGRAM) throw new Error("Program content (data/program.js) didn't load");
  programCache = window.F3_PROGRAM;
  return programCache;
}

function normalizeItem(coll, item) {
  const base = { ...item };
  if (coll === "workouts") {
    Object.assign(base, {
      date: base.date || "", aoId: base.aoId || "", status: base.status || "final",
      intro: base.intro || "", warmup: base.warmup || "", thangs: base.thangs?.length ? base.thangs : [{ title: "Thang 1", content: "" }],
      mary: base.mary || "", notes: base.notes || "", thirdF: base.thirdF || "", announcements: base.announcements || "",
    });
  }
  if (coll === "backblasts") {
    for (const k of ["qs", "pax", "visitors", "fngs"]) if (!Array.isArray(base[k])) base[k] = [];
    for (const k of ["opening", "details", "cot", "date", "aoId", "workoutId"]) base[k] ??= "";
  }
  base.createdAt ||= nowIso();
  base.updatedAt ||= base.createdAt;
  return base;
}

/** Merge program content into the user's data.
 *  - New items are added (source "program") unless the user deleted them before.
 *  - Unedited program items are refreshed when the program changes them.
 *  - Items the user edited (source "program-edited") are never overwritten.
 *  - With "ignore new program content" on, nothing is added or changed. */
async function syncProgram({ force = false } = {}) {
  let prog;
  try { prog = await fetchProgram(); } catch { return null; }
  const p = state.program;
  const firstRun = !p.version;
  p.latestVersion = prog.version;
  if (state.settings.ignoreProgram && !firstRun && !force) { save("program"); return { skipped: true }; }

  const result = { added: 0, updated: 0, version: prog.version };
  for (const coll of PROGRAM_COLLECTIONS) {
    for (const raw of prog[coll] || []) {
      if (!raw.id || p.removed.includes(raw.id)) continue;
      if (coll === "aos" && regionKey() !== "sactown") continue;  // the program's AOs are F3 SacTown's
      const h = hash(JSON.stringify(raw));
      const idx = state[coll].findIndex(x => x.id === raw.id);
      if (idx === -1) {
        state[coll].push(normalizeItem(coll, { ...raw, source: "program" }));
        result.added++;
      } else if (state[coll][idx].source === "program" && p.hashes[raw.id] !== h) {
        const prev = state[coll][idx];
        state[coll][idx] = normalizeItem(coll, { ...raw, source: "program", createdAt: prev.createdAt, updatedAt: nowIso() });
        result.updated++;
      }
      p.hashes[raw.id] = h;
    }
  }
  p.version = prog.version;
  if (!firstRun && (result.added || result.updated)) p.notice = result;
  save("program", ...PROGRAM_COLLECTIONS);
  return result;
}

function forgetProgramItem(item) {
  if ((isProgram(item) || String(item.source || "").startsWith("region")) && !state.program.removed.includes(item.id)) {
    state.program.removed.push(item.id);
    save("program");
  }
}
function markEdited(item) {
  if (item.source === "program") item.source = "program-edited";
  else if (item.source === "region") item.source = "region-edited";
}

/* ------------------------------------------------------------------ */
/* Exicon library                                                      */
/* ------------------------------------------------------------------ */
let libraryCache = null;
async function loadLibrary() {
  if (libraryCache) return libraryCache;
  if (!window.F3_LIBRARY) throw new Error("Library (data/library.js) didn't load");
  const lib = window.F3_LIBRARY;
  const extra = programLibraryItems();
  libraryCache = { ...lib, items: [...lib.items.map(it => ({ ...it, source: it.source || "f3" })), ...extra], count: lib.items.length + extra.length };
  return libraryCache;
}
/** Exercises & thangs from data/program.js (its "library" list plus warm-up/thang/Mary templates),
 *  shown in the Library alongside the Exicon with a Program badge. */
function programLibraryItems() {
  const prog = window.F3_PROGRAM || {};
  const fromLib = (prog.library || []).map(it => ({
    id: it.id, name: it.name || "", text: it.text || it.content || "", kind: it.kind === "thang" ? "thang" : "exercise",
    emphasis: it.emphasis || [], equipment: it.equipment || [], tags: it.tags || [], source: "program",
  }));
  const fromTpl = (prog.templates || []).filter(t => ["warmup", "thang", "mary"].includes(t.section)).map(t => ({
    id: t.id, name: t.name || "", text: t.content || "", kind: "thang",
    emphasis: [], equipment: [], tags: t.section === "thang" ? [] : [t.section], source: "program",
  }));
  return [...fromLib, ...fromTpl];
}
const FILTERS = {
  emphasis: ["upper", "lower", "core", "cardio", "heavy", "run", "ruck", "mobility"],
  equipment: ["coupon", "ruck", "sandbag", "weights", "pull_up_bar", "stairs", "bench_wall", "cones", "field", "speaker", "swing", "timer"],
  tags: ["partner", "routine", "game", "competitive", "mary", "warmup", "finisher", "benchmark", "team"],
};
function searchLibrary(items, { q = "", kind = "all", picked = {} }) {
  const needle = q.trim().toLowerCase();
  let out = items.filter(it => {
    if (kind !== "all" && it.kind !== kind) return false;
    for (const group of Object.keys(FILTERS)) {
      const sel = picked[group] || [];
      if (sel.length && !sel.some(v => it[group].includes(v))) return false;
    }
    if (!needle) return true;
    return it.name.toLowerCase().includes(needle) || it.text.toLowerCase().includes(needle);
  });
  if (needle) {
    const score = it => { const n = it.name.toLowerCase(); return n === needle ? 0 : n.startsWith(needle) ? 1 : n.includes(needle) ? 2 : 3; };
    out = out.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
  }
  return out;
}
/** Where library entries come from; Settings picks which ones the Library shows. */
const LIBRARY_SOURCES = [
  { key: "f3", label: "F3", pill: "f3", desc: "Exercises and thangs from the F3 Nation Exicon." },
  { key: "fia", label: "FiA", pill: "fia", desc: "Exercises and routines from the FiA Lexicon/Exicon." },
  { key: "program", label: "Program", pill: "prog", desc: "Warm-ups, thangs and Mary that come with this app." },
];
function libSource(it) { return isProgram(it) ? "program" : LIBRARY_SOURCES.some(x => x.key === it.source) ? it.source : "f3"; }
function libSourcePill(it) { const src = LIBRARY_SOURCES.find(x => x.key === libSource(it)); return `<span class="pill ${src.pill}">${src.label}</span>`; }
function enabledLibrarySources() {
  const off = Array.isArray(state.settings.libraryHiddenSources) ? state.settings.libraryHiddenSources : [];
  return LIBRARY_SOURCES.map(x => x.key).filter(k => !off.includes(k));
}
function visibleLibraryItems() {
  const on = enabledLibrarySources();
  return libraryCache ? libraryCache.items.filter(it => on.includes(libSource(it))) : [];
}
function libSearchPlaceholder() { return `Search ${libraryCache ? visibleLibraryItems().length : ""} exercises & thangs…`; }
function libTagLine(it) {
  return [it.kind === "thang" ? "thang" : "exercise", ...it.emphasis, ...it.tags.filter(t => t !== "routine")].slice(0, 5).join(" · ");
}

/** Library browser used both as a page and as a picker modal. */
function libraryBrowserHtml({ title = "", picker = false } = {}) {
  return `
    ${title}
    <input class="input" data-lib-q placeholder="${libSearchPlaceholder()}" type="search" autocomplete="off">
    <div class="spacer"></div>
    <select class="input" data-lib-kind>
      <option value="all">All</option><option value="exercise">Exercises</option><option value="thang">Thangs / routines</option>
    </select>
    ${Object.entries(FILTERS).map(([g, vals]) => `
      <div class="filter-group"><div class="field-label">${g}</div>
        <div class="chips">${vals.map(v => `<button class="chip" data-lib-chip="${g}" data-v="${v}">${v.replace(/_/g, " ")}</button>`).join("")}</div>
      </div>`).join("")}
    <div class="label"><span data-lib-count></span><button class="linkish" data-lib-clear>Clear filters</button></div>
    <div data-lib-list></div>
    <div class="more"><button class="btn sm hidden" data-lib-more>Show more</button></div>
    <p class="hint">${enabledLibrarySources().length === LIBRARY_SOURCES.length ? "Showing all sources." : `Showing only: ${LIBRARY_SOURCES.filter(x => enabledLibrarySources().includes(x.key)).map(x => `<span class="pill ${x.pill}">${x.label}</span>`).join(" ")}.`}
      ${picker ? "Tap a name to read it, + to add it." : `Tap a name to read it. <button class="linkish" data-go="#/settings">Change sources in Settings ›</button>`}</p>`;
}
function bindLibraryBrowser(root, { onPick } = {}) {
  const st = { q: "", kind: "all", picked: { emphasis: [], equipment: [], tags: [] }, limit: 60, open: new Set() };
  const listEl = $("[data-lib-list]", root);
  const draw = () => {
    if (!libraryCache) { listEl.innerHTML = `<div class="empty">Loading library…</div>`; return; }
    if (!enabledLibrarySources().length) {
      $("[data-lib-count]", root).textContent = "0 matches";
      listEl.innerHTML = `<div class="empty">No library sources are turned on. Pick at least one under Settings → Exicon library sources.</div>`;
      $("[data-lib-more]", root).classList.add("hidden"); return;
    }
    const res = searchLibrary(visibleLibraryItems(), st);
    $("[data-lib-count]", root).textContent = `${res.length} match${res.length === 1 ? "" : "es"}`;
    listEl.innerHTML = res.slice(0, st.limit).map(it => `
      <div class="lib-item" data-id="${it.id}">
        <div class="lib-head" data-toggle>
          <div class="name">${esc(it.name)} ${libSourcePill(it)}</div>
          <div class="tags">${esc(libTagLine(it))}</div>
          ${onPick ? `<button class="round-btn" data-add title="Add">+</button>` : ""}
        </div>
        ${st.open.has(it.id) ? `<div class="lib-body">${esc(it.text || "No description.")}
          <div class="btn-row">${onPick ? `<button class="btn sm accent" data-add>Add to workout</button>` : ""}<button class="btn sm" data-copy>Copy</button></div></div>` : ""}
      </div>`).join("") || `<div class="empty">Nothing matches. Try fewer filters.</div>`;
    $("[data-lib-more]", root).classList.toggle("hidden", res.length <= st.limit);
  };
  const q = $("[data-lib-q]", root);
  q.addEventListener("input", debounce(() => { st.q = q.value; st.limit = 60; draw(); }, 120));
  $("[data-lib-kind]", root).addEventListener("change", e => { st.kind = e.target.value; st.limit = 60; draw(); });
  $$("[data-lib-chip]", root).forEach(b => b.addEventListener("click", () => {
    const arr = st.picked[b.dataset.libChip]; const v = b.dataset.v;
    const i = arr.indexOf(v); i === -1 ? arr.push(v) : arr.splice(i, 1);
    b.classList.toggle("on", i === -1); st.limit = 60; draw();
  }));
  $("[data-lib-clear]", root).addEventListener("click", () => {
    Object.values(st.picked).forEach(a => a.splice(0)); st.q = ""; q.value = ""; st.kind = "all"; $("[data-lib-kind]", root).value = "all";
    $$("[data-lib-chip]", root).forEach(b => b.classList.remove("on")); draw();
  });
  $("[data-lib-more]", root).addEventListener("click", () => { st.limit += 60; draw(); });
  listEl.addEventListener("click", e => {
    const item = e.target.closest(".lib-item"); if (!item) return;
    const it = libraryCache.items.find(x => x.id === item.dataset.id);
    if (e.target.closest("[data-add]")) { e.stopPropagation(); onPick?.(it); return; }
    if (e.target.closest("[data-copy]")) { copyText(`${it.name}\n${it.text}`); return; }
    if (e.target.closest("[data-toggle]")) { st.open.has(it.id) ? st.open.delete(it.id) : st.open.add(it.id); draw(); }
  });
  draw();
  if (!libraryCache) loadLibrary().then(() => { q.placeholder = libSearchPlaceholder(); draw(); })
    .catch(() => { listEl.innerHTML = `<div class="empty">Couldn't load the library. Check your connection and reload.</div>`; });
}

/* ------------------------------------------------------------------ */
/* Workout text                                                        */
/* ------------------------------------------------------------------ */
const SECTION_LABELS = { intro: "Introduction", warmup: "Warm-O-Rama", thang: "Thang", mary: "Mary / Finisher", notes: "Notes", thirdF: "Third F", announcements: "Announcements", cot: "Backblast COT / Closing" };
const TEMPLATE_SECTIONS = ["intro", "warmup", "thang", "mary", "notes", "cot"];

function thangLabel(t, i) {
  const title = (t.title || "").trim();
  const def = `Thang ${i + 1}`;
  return !title || title === def ? def : `${def} — ${title}`;
}
function workoutSections(w, { includeNotes = true, includeTitle = true } = {}) {
  const parts = [];
  if (includeTitle) parts.push([null, `Title: ${w.title || "Untitled Workout"}`]);
  const add = (label, txt) => { if ((txt || "").trim()) parts.push([label, txt.trim()]); };
  add("Introduction", w.intro);
  add("Warm-O-Rama", w.warmup);
  (w.thangs || []).forEach((t, i) => add(thangLabel(t, i), t.content));
  add("Mary / Finisher", w.mary);
  if (includeNotes) add("Notes", w.notes);
  add("Third F", w.thirdF);
  add("Announcements", w.announcements);
  return parts;
}
function workoutText(w, opts) {
  return workoutSections(w, opts).map(([label, body]) => label ? `${label}:\n${body}` : body).join("\n\n");
}

/* ------------------------------------------------------------------ */
/* Backblast text                                                      */
/* ------------------------------------------------------------------ */
function bbCount(bb) { return bb.qs.length + bb.pax.length + bb.visitors.length + bb.fngs.length; }
function autoOpening(bb) {
  const ao = aoById(bb.aoId);
  return (state.settings.openingTemplate || DEFAULT_SETTINGS.openingTemplate)
    .replaceAll("{count}", bbCount(bb))
    .replaceAll("{ao}", ao?.name || "the AO")
    .replaceAll("{why}", state.settings.defaultWhy || "get 1% better")
    .replaceAll("{date}", fmtDate(bb.date))
    .replaceAll("{q}", bb.qs.join(" & "));
}
function autoDetails(bb) {
  const w = state.workouts.find(x => x.id === bb.workoutId);
  return w ? workoutText(w, { includeNotes: false }) : "";
}
function liveData(bb) {
  const ao = aoById(bb.aoId);
  const at = n => `@${n}`;
  const list = arr => arr.length ? arr.map(at).join("\n") : "None";
  const lines = [];
  lines.push([ao?.name || "AO", fmtDate(bb.date)].filter(Boolean).join(" · "));
  const loc = [ao?.location, ao?.address].filter(Boolean).join(" — ");
  if (loc) lines.push(loc);
  lines.push("", `Total Attendees: ${bbCount(bb)}`, "");
  lines.push(bb.qs.length > 1 ? `Qs (${bb.qs.length}):\n${list(bb.qs)}` : `Q: ${bb.qs.length ? at(bb.qs[0]) : "-"}`);
  lines.push("", `PAX (${bb.pax.length}):\n${list(bb.pax)}`);
  lines.push("", `Visiting PAX (${bb.visitors.length}):\n${list(bb.visitors)}`);
  lines.push("", `FNGs (${bb.fngs.length}):\n${list(bb.fngs)}`);
  return lines.join("\n");
}
function refreshAuto(bb) {
  if (!bb.openingEdited) bb.opening = autoOpening(bb);
  if (!bb.detailsEdited) bb.details = autoDetails(bb);
}
function backblastText(bb) {
  return [bb.opening, liveData(bb), bb.details, bb.cot ? `COT:\n${bb.cot}` : ""]
    .map(s => (s || "").trim()).filter(Boolean).join("\n\n");
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */
const ICON = {
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h14"/></svg>`,
  plan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/><path d="M3 7h2M3 11h2M3 15h2"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17M8 14h8M8 17.5h5"/></svg>`,
  megaphone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 11.5h5"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>`,
  history: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7.5V12l3 2"/></svg>`,
};

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */
const app = () => $("#app");
let cleanup = null;

function topbar(back = "#/home") {
  return `<div class="topbar"><button class="back-link" data-back="${back}">← Back</button>
    <button class="menu-btn" data-menu aria-label="Menu">${ICON.menu}</button></div>`;
}
function bottomNav(active) {
  const btn = (k, label, href) => `<button class="${active === k ? "on" : ""}" data-go="${href}">${label}</button>`;
  return `<nav class="bottom-nav"><div class="inner">${btn("home", "Home", "#/home")}${btn("planner", "Planner", "#/planner")}${btn("backblast", "Backblast", "#/backblasts")}</div></nav>`;
}
function openMenu() {
  const cur = location.hash || "#/home";
  const item = (label, href) => `<button class="item ${cur === href ? "on" : ""}" data-go="${href}">${label}</button>`;
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  const drawer = document.createElement("aside");
  drawer.className = "drawer";
  drawer.innerHTML = `
    <div class="drawer-head"><h2>Menu</h2><button class="tiny-btn" data-x>Close</button></div>
    ${item("Home", "#/home")}
    <div class="group">Workouts</div>
    ${item("My Planner", "#/planner")}${item("Plan Workout", "#/plan")}${item("Exicon Library", "#/library")}${item("My Templates", "#/templates")}
    <div class="group">Backblast</div>
    ${item("Backblasts", "#/backblasts")}${item("New Backblast", "#/backblast/new")}
    <div class="group">Setup</div>
    ${item("AOs", "#/aos")}${item("Settings", "#/settings")}${item("Import / Export", "#/data")}`;
  const close = () => { scrim.remove(); drawer.remove(); };
  scrim.onclick = close;
  $("[data-x]", drawer).onclick = close;
  drawer.addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (b) { close(); go(b.dataset.go); } });
  document.body.append(scrim, drawer);
}
function go(href) { if (location.hash === href) render(); else location.hash = href; }

document.addEventListener("click", e => {
  const g = e.target.closest("[data-go]");
  if (g && !g.closest(".drawer")) { e.preventDefault(); go(g.dataset.go); return; }
  const b = e.target.closest("[data-back]");
  if (b) { go(b.dataset.back); return; }
  if (e.target.closest("[data-menu]")) openMenu();
});

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */
function parseHash() {
  const raw = (location.hash || "#/home").slice(2);
  const [path, query = ""] = raw.split("?");
  return { parts: path.split("/").filter(Boolean), query: new URLSearchParams(query) };
}
function render() {
  cleanup?.(); cleanup = null;
  $$(".scrim, .drawer").forEach(n => n.remove());
  const { parts, query } = parseHash();
  const [r, id] = parts;
  const routes = {
    home: viewHome, planner: viewPlanner, plan: () => viewPlan(id, query), workout: () => viewWorkout(id),
    run: () => viewRun(id), backblasts: viewBackblasts, backblast: () => viewBackblast(id, query),
    library: viewLibrary, templates: viewTemplates, aos: viewAos, settings: () => viewSettings(query), data: viewData,
  };
  (routes[r] || viewHome)();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", render);

/* ------------------------------------------------------------------ */
/* Home                                                                */
/* ------------------------------------------------------------------ */
function upcomingWorkouts() {
  const t = todayISO();
  return state.workouts.filter(w => w.date && w.date >= t).sort((a, b) => a.date.localeCompare(b.date));
}
function greetingWord() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
function viewHome() {
  const s = state.settings;
  const up = upcomingWorkouts();
  const next = up[0];
  const others = up.slice(1, 4);
  const bbs = [...state.backblasts].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const userWorkouts = state.workouts.filter(w => w.source !== "program");
  // Posts and Qs come from the region's attendance data, looked up by the F3 name in Settings.
  const mine = regionTotals(s.f3Name);
  const statsNote = mine ? "" : regionKey() === "none" ? `<button class="linkish" data-go="#/settings?focus=region">Choose a region</button> to see your posts and Qs.`
    : !s.f3Name ? `<button class="linkish" data-go="#/settings?focus=f3Name">Set your nickname</button> to see your posts and Qs.`
    : `No posts found for “${esc(s.f3Name)}” in ${esc(s.regionName || "your region")}'s data. Check that your nickname matches the sheet.`;
  const homeAo = aoName(s.homeAoId);
  const notice = state.program.notice;
  const isToday = next && next.date === todayISO();

  const hero = next ? `
    <div class="hero">
      <div class="meta">${isToday ? "Today" : esc(fmtDate(next.date))}${next.aoId ? " · " + esc(aoName(next.aoId)) : ""}</div>
      <h2>${esc(next.title || "Untitled Workout")}</h2>
      <p>${next.status === "draft" ? "Draft — finish planning before you head out." : "Your beatdown is planned. Run it from your phone at the AO."}</p>
      <div class="hero-actions">
        ${isToday ? `<button class="btn primary" data-go="#/run/${next.id}">Run Workout</button>
          <button class="btn ghost" data-go="#/backblast/new?w=${next.id}">Write Backblast</button>`
        : `<button class="btn primary" data-go="#/workout/${next.id}">Open Workout</button>
          <button class="btn ghost" data-go="#/plan/${next.id}">Edit Plan</button>`}
      </div>
    </div>` : `
    <div class="hero">
      <h2>No Upcoming Qs</h2>
      <p>Plan your next beatdown and it will show up here.</p>
      <div class="hero-actions">
        <button class="btn primary" data-go="#/plan">Plan a Workout</button>
        <button class="btn ghost" data-go="#/planner">View Planner</button>
      </div>
    </div>`;

  const tile = (href, icon, title, sub, blue) => `
    <button class="tile" data-go="${href}"><span class="ico ${blue ? "blue" : ""}">${icon}</span><span class="chev">›</span>
      <strong>${title}</strong><span>${sub}</span></button>`;

  app().innerHTML = `
    <div class="home-head">
      <div class="home-head-left">
        ${s.logo ? `<img class="home-logo" src="${esc(s.logo)}" alt="${esc(s.regionName || "Region")} logo">` : ""}
        <div class="home-id">
          <h1 class="region-title">${esc(s.regionName || DEFAULT_SETTINGS.regionName)}</h1>
          <button class="greeting" data-go="#/settings">${greetingWord()}, ${esc(s.f3Name || "{PAX}")}<span class="chev">›</span></button>
          <div class="greeting-row"><span class="muted" style="font-size:14px">Keep showing up.</span>
            ${!regionNameSet() ? `<button class="pill" data-go="#/settings?focus=region" style="background:none;cursor:pointer">Choose region</button>`
              : homeAo ? `<span class="pill">Home AO · ${esc(homeAo)}</span>`
              : s.f3Name ? "" : `<button class="pill" data-go="#/settings?focus=f3Name" style="background:none;cursor:pointer">Set your nickname</button>`}</div>
        </div>
      </div>
      <button class="menu-btn" data-menu aria-label="Menu" style="margin-top:2px">${ICON.menu}</button>
    </div>
    <div class="page" style="padding-top:0">
      ${notice ? `<div class="spacer"></div><div class="banner info"><span>App update ${esc(notice.version)}: ${notice.added} new and ${notice.updated} updated program items (templates, AOs, sample workouts).</span>
        <span class="btn-row" style="flex-wrap:nowrap"><button class="btn sm" data-go="#/templates">Review</button><button class="btn sm ghost" data-dismiss>Dismiss</button></span></div>` : ""}
      <div class="label accent">Next action</div>
      ${hero}
      <div class="label">Quick access</div>
      <div class="tiles">
        ${tile("#/plan", ICON.plan, "Plan Workout", "Build your beatdown", false)}
        ${tile("#/planner", ICON.calendar, "My Planner", "Upcoming & past BDs", true)}
        ${tile("#/backblast/new", ICON.megaphone, "Backblast", "Write & share", true)}
        ${tile("#/library", ICON.book, "Exicon", "Browse exercises", false)}
        ${tile("#/templates", ICON.layers, "Templates", "Reusable sections", false)}
      </div>
      <div class="label">Upcoming Qs</div>
      ${others.length ? `<div class="list">${others.map(workoutRow).join("")}</div>` : `
        <div class="card dashed"><h3>No other upcoming Qs</h3><p>Plan another when you're ready.</p>
          <div style="margin-top:8px"><button class="linkish" data-go="#/planner">View Planner</button></div></div>`}
      <div class="label">My stats <button class="linkish" data-go="#/backblasts">Backblasts ›</button></div>
      <div class="stats">
        <div class="stats-grid">
          <div class="stat"><b>${mine ? mine[0].toLocaleString() : "—"}</b><span>Total posts</span></div>
          <div class="stat"><b>${mine ? mine[1].toLocaleString() : "—"}</b><span>Total Qs</span></div>
          <div class="stat"><b>${userWorkouts.length}</b><span>Qs planned</span></div>
        </div>
        ${statsNote ? `<p class="muted stats-note">${statsNote}</p>` : ""}
        <button class="stats-foot" data-go="${bbs[0] ? "#/backblast/" + bbs[0].id : "#/backblast/new"}">
          <span>Last backblast <b>${bbs[0] ? esc(fmtDate(bbs[0].date, { month: "short", day: "numeric", year: "numeric" })) : "—"}</b></span><span>›</span></button>
      </div>
    </div>
    ${bottomNav("home")}`;
  $("[data-dismiss]")?.addEventListener("click", () => { state.program.notice = null; save("program"); render(); });
  const logo = $(".home-logo");
  if (logo) {
    const fit = () => fitHomeLogo(logo);
    if (logo.complete) fit(); else logo.addEventListener("load", fit, { once: true });
    const onResize = debounce(fit, 80);
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(fit);
    cleanup = () => window.removeEventListener("resize", onResize);
  }
}

/** Size the home-page logo so its bottom lines up with the bottom of "Keep showing up."
 *  The logo's width changes how the text wraps, so settle it over a few passes. */
function fitHomeLogo(img) {
  const sub = $(".home-id .greeting-row .muted");
  if (!img.isConnected || !sub) return;
  for (let i = 0; i < 4; i++) {
    const want = Math.round(sub.getBoundingClientRect().bottom - img.getBoundingClientRect().top);
    const h = Math.max(48, Math.min(want, 260));
    if (Math.abs(img.offsetHeight - h) < 1) break;
    img.style.height = h + "px";
  }
}

/* ------------------------------------------------------------------ */
/* Planner                                                             */
/* ------------------------------------------------------------------ */
function workoutRow(w) {
  const firstThang = (w.thangs || []).find(t => (t.title || t.content || "").trim());
  const eyebrow = [w.date ? fmtDate(w.date) : "No date", aoName(w.aoId)].filter(Boolean).join(" · ");
  return `<button class="row" data-go="#/workout/${w.id}">
    <div class="grow"><div class="eyebrow">${esc(eyebrow)}</div>
      <div class="title">${esc(w.title || "Untitled Workout")}
        ${w.status === "draft" ? ` <span class="pill draft">Draft</span>` : ""}${isProgram(w) ? ` <span class="pill prog">Program</span>` : ""}</div>
      ${firstThang ? `<div class="sub">${esc(firstThang.title || firstThang.content.split("\n")[0])}</div>` : ""}</div>
    <span class="chev">›</span></button>`;
}
function viewPlanner() {
  const t = todayISO();
  const up = upcomingWorkouts();
  const uns = state.workouts.filter(w => !w.date).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const past = state.workouts.filter(w => w.date && w.date < t).sort((a, b) => b.date.localeCompare(a.date));
  app().innerHTML = `${topbar()}
    <div class="page" style="padding-top:4px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <h1 class="page-title">My Planner</h1><button class="btn accent sm" style="border-radius:12px;padding:10px 14px" data-go="#/plan">+ New Workout</button></div>
      <p class="page-sub">Plan your upcoming workouts.</p>
      <div class="list" style="background:linear-gradient(160deg,#0d161d,#07090b)">
        <div style="padding:16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-end">
          <div><div class="field-label" style="color:var(--accent);margin:0">Your Q schedule</div><div style="font-family:var(--font-display);font-weight:700;font-size:22px">UPCOMING QS</div></div>
          <span class="muted" style="font-size:13px;font-weight:600">${up.length} Upcoming Workout${up.length === 1 ? "" : "s"}</span></div>
        ${up.length ? up.map(workoutRow).join("") : `<div class="empty">No upcoming workouts planned.</div>`}
      </div>
      <div class="label">Unscheduled workouts (${uns.length})</div>
      <div class="list">${uns.length ? uns.map(workoutRow).join("") : `<div class="empty">No unscheduled workouts.</div>`}</div>
      <div class="label">Past workouts (${past.length})</div>
      <div class="list">${past.length ? past.map(workoutRow).join("") : `<div class="empty">No past workouts yet.</div>`}</div>
    </div>${bottomNav("planner")}`;
}

/* ------------------------------------------------------------------ */
/* Plan workout                                                        */
/* ------------------------------------------------------------------ */
function aoOptions(selected) {
  return `<option value="">${state.aos.length ? "Select AO" : "No AOs yet — add in Settings › AOs"}</option>` +
    state.aos.map(a => `<option value="${a.id}" ${a.id === selected ? "selected" : ""}>${esc(a.name)}</option>`).join("");
}
function blankWorkout() {
  return normalizeItem("workouts", {
    id: uid("w"), title: "", date: todayISO(), aoId: state.settings.homeAoId || "", status: "draft", source: "user",
    thangs: [{ title: "Thang 1", content: "" }],
  });
}
function viewPlan(id, query) {
  const existing = id ? state.workouts.find(w => w.id === id) : null;
  if (id && !existing) { toast("Workout not found"); return go("#/planner"); }
  const w = existing ? structuredClone(existing) : blankWorkout();
  if (query.get("date")) w.date = query.get("date");
  let persisted = !!existing;

  const persist = () => {
    w.updatedAt = nowIso();
    if (persisted) markEdited(w);
    const idx = state.workouts.findIndex(x => x.id === w.id);
    if (idx === -1) state.workouts.push(structuredClone(w)); else state.workouts[idx] = structuredClone(w);
    if (active && !persisted && location.hash !== `#/plan/${w.id}`) history.replaceState(null, "", `#/plan/${w.id}`);
    persisted = true;
    save("workouts");
    const st = $("[data-savestate]"); if (st) st.textContent = "Draft saved";
  };
  const autosave = debounce(persist, 500);
  let active = true;
  cleanup = () => { active = false; autosave.flush(); };
  const hasContent = x => [x.title, x.intro, x.warmup, x.mary, x.notes, x.thirdF, x.announcements, ...x.thangs.map(t => t.content)].some(v => (v || "").trim());

  const sectionHtml = (key, { lib = false, tpl = true, placeholder = "" } = {}) => `
    <div class="section">
      <div class="section-head"><span class="field-label">${SECTION_LABELS[key]}</span>${lib ? `<button class="chip-btn" data-lib="${key}">Library</button>` : ""}</div>
      <textarea class="input" data-field="${key}" placeholder="${esc(placeholder)}">${esc(w[key])}</textarea>
      ${tpl ? `<div class="section-tools"><button class="tiny-btn" data-savetpl="${key}">Save Section as Template</button><button class="tiny-btn" data-instpl="${key}">Insert Saved Template</button></div>` : ""}
    </div>`;

  app().innerHTML = `${topbar("#/planner")}
    <div class="page" style="padding-top:4px">
      <h1 class="page-title">Plan Workout</h1>
      <p class="page-sub">Build your beatdown from top to bottom. <span data-savestate>Your draft saves as you work.</span></p>
      <button class="btn accent block" data-browse>Browse &amp; Copy Workouts</button>
      <div class="spacer"></div>
      <div class="card">
        <div class="field-label">Workout details</div>
        <label class="field"><span>Date</span><input class="input" type="date" data-field="date" value="${esc(w.date)}"></label>
        <label class="field"><span>AO</span><select class="input" data-field="aoId">${aoOptions(w.aoId)}</select></label>
        <label class="field" style="margin:0"><span>Workout title</span><input class="input" data-field="title" value="${esc(w.title)}" placeholder="Name your beatdown"></label>
      </div>
      ${sectionHtml("intro")}
      ${sectionHtml("warmup", { lib: true })}
      <div class="section">
        <div class="field-label">Thangs</div>
        <div data-thangs></div>
        <button class="add-thang" data-addthang>+ Add Thang</button>
      </div>
      ${sectionHtml("mary", { lib: true })}
      ${sectionHtml("notes", { placeholder: "Private notes for you — not included in the backblast" })}
      ${sectionHtml("thirdF", { tpl: false, placeholder: "Third F discussion" })}
      ${sectionHtml("announcements", { tpl: false, placeholder: "Announcements for this BD…" })}
      <div class="sticky-actions">
        <button class="btn" data-preview>Preview</button>
        <button class="btn accent" data-savedraft>Save Draft</button>
        <button class="btn light" data-finalize>Finalize &amp; Save</button>
      </div>
    </div>`;

  const thangsEl = $("[data-thangs]");
  const drawThangs = () => {
    thangsEl.innerHTML = w.thangs.map((t, i) => `
      <div class="thang" data-i="${i}">
        <div class="thang-head"><input class="input" data-tfield="title" value="${esc(t.title)}" placeholder="Thang ${i + 1}">
          <button class="chip-btn" data-tlib>Library</button>
          ${w.thangs.length > 1 ? `<button class="chip-btn" style="color:var(--muted)" data-tremove>Remove</button>` : ""}</div>
        <textarea class="input" data-tfield="content" placeholder="Write this Thang…">${esc(t.content)}</textarea>
        <div class="section-tools"><button class="tiny-btn" data-tsave>Save Thang</button><button class="tiny-btn" data-tins>Insert Saved Thang</button>
          ${i > 0 ? `<button class="tiny-btn" data-tup>Move up</button>` : ""}</div>
      </div>`).join("");
  };
  drawThangs();

  const setField = (key, val) => { w[key] = val; const el = $(`[data-field="${key}"]`); if (el) el.value = val; autosave(); };
  const appendTo = (cur, text) => (cur || "").trim() ? `${cur.replace(/\s+$/, "")}\n\n${text}` : text;

  $$("[data-field]").forEach(el => el.addEventListener(el.tagName === "SELECT" || el.type === "date" ? "change" : "input", () => { w[el.dataset.field] = el.value; autosave(); }));
  thangsEl.addEventListener("input", e => {
    const box = e.target.closest(".thang"); const f = e.target.dataset.tfield;
    if (box && f) { w.thangs[+box.dataset.i][f] = e.target.value; autosave(); }
  });
  thangsEl.addEventListener("click", e => {
    const box = e.target.closest(".thang"); if (!box) return;
    const i = +box.dataset.i; const t = w.thangs[i];
    if (e.target.closest("[data-tremove]")) {
      w.thangs.splice(i, 1);
      w.thangs.forEach((x, j) => { if (/^Thang \d+$/.test(x.title)) x.title = `Thang ${j + 1}`; });
      drawThangs(); autosave();
    } else if (e.target.closest("[data-tup]")) {
      [w.thangs[i - 1], w.thangs[i]] = [w.thangs[i], w.thangs[i - 1]]; drawThangs(); autosave();
    } else if (e.target.closest("[data-tlib]")) {
      openLibraryPicker("Thang", it => { t.content = appendTo(t.content, `${it.name}\n${it.text}`); drawThangs(); autosave(); toast(`Added ${it.name}`); });
    } else if (e.target.closest("[data-tsave]")) {
      saveTemplateModal("thang", t.content, /^Thang \d+$/.test(t.title) ? "" : t.title);
    } else if (e.target.closest("[data-tins]")) {
      insertTemplateModal("thang", tpl => {
        t.content = appendTo(t.content, tpl.content);
        if (!t.title || /^Thang \d+$/.test(t.title)) t.title = tpl.name;
        drawThangs(); autosave();
      });
    }
  });
  $("[data-addthang]").onclick = () => { w.thangs.push({ title: `Thang ${w.thangs.length + 1}`, content: "" }); drawThangs(); autosave(); $$(".thang textarea").pop()?.focus(); };
  $$("[data-lib]").forEach(b => b.onclick = () => {
    const key = b.dataset.lib;
    openLibraryPicker(SECTION_LABELS[key], it => { setField(key, appendTo(w[key], `${it.name}\n${it.text}`)); toast(`Added ${it.name}`); });
  });
  $$("[data-savetpl]").forEach(b => b.onclick = () => saveTemplateModal(b.dataset.savetpl, w[b.dataset.savetpl]));
  $$("[data-instpl]").forEach(b => b.onclick = () => insertTemplateModal(b.dataset.instpl, tpl => setField(b.dataset.instpl, appendTo(w[b.dataset.instpl], tpl.content))));
  $("[data-preview]").onclick = () => {
    const txt = workoutText(w);
    openModal(`<h2>Preview</h2><button class="tiny-btn modal-close" data-close>Close</button><pre>${esc(txt)}</pre>
      <div class="btn-row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-copy>Copy</button></div>`,
      m => { $("[data-copy]", m).onclick = () => copyText(txt); });
  };
  $("[data-savedraft]").onclick = () => { w.status = "draft"; persist(); toast("Draft saved"); };
  $("[data-finalize]").onclick = () => {
    if (!w.title.trim()) { toast("Give the workout a title first"); $('[data-field="title"]').focus(); return; }
    w.status = "final"; persist(); toast("Workout saved"); go(`#/workout/${w.id}`);
  };
  $("[data-browse]").onclick = () => {
    const others = state.workouts.filter(x => x.id !== w.id).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    openModal(`<h2>Browse &amp; Copy Workouts</h2><button class="tiny-btn modal-close" data-close>Close</button>
      <p class="muted" style="margin-top:0">Copies the sections into this plan. Date and AO stay as they are.</p>
      <div class="list">${others.map(x => `<button class="row" data-pick="${x.id}"><div class="grow"><div class="eyebrow">${esc([x.date ? fmtDate(x.date) : "No date", aoName(x.aoId)].filter(Boolean).join(" · "))}</div>
        <div class="title">${esc(x.title || "Untitled Workout")}${isProgram(x) ? ` <span class="pill prog">Program</span>` : ""}</div></div><span class="chev">›</span></button>`).join("") || `<div class="empty">No other workouts saved yet.</div>`}</div>`,
      (m, close) => $$("[data-pick]", m).forEach(b => b.onclick = async () => {
        const src = state.workouts.find(x => x.id === b.dataset.pick);
        if (hasContent(w) && !(await confirmModal("This replaces what you've written in this plan.", "Copy workout"))) return;
        Object.assign(w, { title: src.title, intro: src.intro, warmup: src.warmup, thangs: structuredClone(src.thangs), mary: src.mary, notes: src.notes, thirdF: src.thirdF, announcements: src.announcements });
        close(); persist(); viewPlanRedraw();
      }));
  };
  const viewPlanRedraw = () => { cleanup = null; location.hash === `#/plan/${w.id}` ? viewPlan(w.id, new URLSearchParams()) : (location.hash = `#/plan/${w.id}`); };
}

function openLibraryPicker(sectionLabel, onPick) {
  openModal(libraryBrowserHtml({ title: `<h2>Ideas for ${esc(sectionLabel)}</h2><button class="tiny-btn modal-close" data-close>Close</button>`, picker: true }),
    m => bindLibraryBrowser(m, { onPick }));
}
function saveTemplateModal(section, content, name = "") {
  if (!(content || "").trim()) { toast("Write something in this section first"); return; }
  openModal(`<h2>Save as ${esc(SECTION_LABELS[section])} template</h2><button class="tiny-btn modal-close" data-close>Close</button>
    <label class="field"><span>Template name</span><input class="input" data-name value="${esc(name)}" placeholder="e.g. My go-to warm-up"></label>
    <label class="field"><span>Content</span><textarea class="input" data-content>${esc(content)}</textarea></label>
    <div class="btn-row" style="justify-content:flex-end"><button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save Template</button></div>`,
    (m, close) => $("[data-save]", m).onclick = () => {
      const nm = $("[data-name]", m).value.trim();
      if (!nm) { toast("Name the template"); return; }
      state.templates.push({ id: uid("t"), section, name: nm, content: $("[data-content]", m).value, source: "user", createdAt: nowIso(), updatedAt: nowIso() });
      save("templates"); close(); toast("Template saved");
    });
}
function insertTemplateModal(section, onPick) {
  const list = state.templates.filter(t => t.section === section);
  openModal(`<h2>Insert ${esc(SECTION_LABELS[section])} template</h2><button class="tiny-btn modal-close" data-close>Close</button>
    ${list.length ? list.map(t => `<div class="template-card"><div class="grow"><strong>${esc(t.name)}</strong> ${isProgram(t) ? `<span class="pill prog">Program</span>` : ""}
      <div class="content">${esc(t.content)}</div></div><div class="acts"><button class="btn sm accent" data-pick="${t.id}">Insert</button></div></div>`).join("")
      : `<div class="empty">No saved ${esc(SECTION_LABELS[section])} templates yet.<br>Use “Save Section as Template” or add them in My Templates.</div>`}`,
    (m, close) => $$("[data-pick]", m).forEach(b => b.onclick = () => { onPick(state.templates.find(t => t.id === b.dataset.pick)); close(); }));
}

/* ------------------------------------------------------------------ */
/* Workout detail & run                                                */
/* ------------------------------------------------------------------ */
function readSections(w, run = false) {
  return workoutSections(w, { includeTitle: false }).map(([label, body]) => `
    <div class="read-section"><h4>${esc(label)}</h4><div class="body">${run ? body.split("\n").map((l, i) => i === 0 ? `<span class="first">${esc(l)}</span>` : esc(l)).join("\n") : esc(body)}</div></div>`).join("")
    || `<div class="empty">Nothing planned yet.</div>`;
}
function viewWorkout(id) {
  const w = state.workouts.find(x => x.id === id);
  if (!w) { toast("Workout not found"); return go("#/planner"); }
  app().innerHTML = `${topbar("#/planner")}
    <div class="page" style="padding-top:4px">
      <h1 class="page-title">${esc(w.title || "Untitled Workout")}</h1>
      <div class="spacer"></div>
      ${w.status === "draft" ? `<div class="banner" style="color:#f2c46d;border-color:rgba(242,196,109,.35)">Draft — finalize it in the planner when you're ready.</div>` : `<div class="banner">Saved on this device</div>`}
      <div class="meta-grid">
        <div><span>Date</span><b>${esc(w.date ? fmtDate(w.date) : "Unscheduled")}</b></div>
        <div><span>AO</span><b>${esc(aoName(w.aoId) || "—")}</b></div>
        <div><span>Status</span><b>${w.status === "draft" ? "Draft" : "Ready"}${isProgram(w) ? " · Program" : ""}</b></div>
      </div>
      ${readSections(w)}
      <div class="spacer"></div><div class="spacer"></div>
      <div class="btn-grid">
        <button class="btn light full" data-go="#/run/${w.id}">Run Workout</button>
        <button class="btn accent full" data-go="#/plan/${w.id}">Edit Workout</button>
        <button class="btn" data-go="#/backblast/new?w=${w.id}">Write Backblast</button>
        <button class="btn" data-copynew>Copy to New Plan</button>
        <button class="btn" data-share>Share Workout</button>
        <button class="btn" data-copytext>Copy Text</button>
        <button class="btn danger full" data-del>Delete Workout</button>
      </div>
    </div>${bottomNav("planner")}`;
  $("[data-share]").onclick = () => shareText(w.title, workoutText(w, { includeNotes: false }));
  $("[data-copytext]").onclick = () => copyText(workoutText(w));
  $("[data-copynew]").onclick = () => {
    const c = normalizeItem("workouts", { ...structuredClone(w), id: uid("w"), date: "", status: "draft", source: "user", createdAt: nowIso(), updatedAt: nowIso(), title: `${w.title || "Untitled"} (copy)` });
    state.workouts.push(c); save("workouts"); toast("Copied — pick a date and AO"); go(`#/plan/${c.id}`);
  };
  $("[data-del]").onclick = async () => {
    if (!(await confirmModal(`Delete “${w.title || "Untitled Workout"}”? This can't be undone.`, "Delete"))) return;
    forgetProgramItem(w);
    state.workouts = state.workouts.filter(x => x.id !== w.id); save("workouts"); toast("Workout deleted"); go("#/planner");
  };
}

let wakeLock = null;
function viewRun(id) {
  const w = state.workouts.find(x => x.id === id);
  if (!w) return go("#/planner");
  const sizes = { normal: "1.02rem", large: "1.2rem", xl: "1.5rem" };
  const draw = () => {
    app().innerHTML = `${topbar(`#/workout/${w.id}`)}
      <div class="page run" style="padding-top:4px;--run-size:${sizes[state.settings.runTextSize] || sizes.large}">
        <h1 class="page-title">${esc(w.title || "Untitled Workout")}</h1><div class="spacer"></div>
        <div class="banner good">Running workout${w.aoId ? " at " + esc(aoName(w.aoId)) : ""}</div>
        <div class="field-label" style="margin-top:14px">Text size</div>
        <div class="seg">${["normal", "large", "xl"].map(s => `<button data-size="${s}" class="${state.settings.runTextSize === s ? "on" : ""}">${s === "xl" ? "XL" : s[0].toUpperCase() + s.slice(1)}</button>`).join("")}</div>
        ${readSections(w, true)}
        <div class="spacer"></div>
        <button class="btn light block" data-go="#/backblast/new?w=${w.id}">Finish &amp; Write Backblast</button>
        <div class="spacer"></div>
        <button class="btn accent block" data-go="#/plan/${w.id}">Edit Workout</button>
      </div>`;
    $$("[data-size]").forEach(b => b.onclick = () => { state.settings.runTextSize = b.dataset.size; save("settings"); const y = scrollY; draw(); scrollTo(0, y); });
  };
  draw();
  if ("wakeLock" in navigator) navigator.wakeLock.request("screen").then(l => (wakeLock = l)).catch(() => {});
  cleanup = () => { wakeLock?.release?.().catch(() => {}); wakeLock = null; };
}

/* ------------------------------------------------------------------ */
/* Backblasts                                                          */
/* ------------------------------------------------------------------ */
function viewBackblasts() {
  const list = [...state.backblasts].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
  app().innerHTML = `${topbar()}
    <div class="page" style="padding-top:4px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <h1 class="page-title">Backblasts</h1><button class="btn accent sm" style="border-radius:12px;padding:10px 14px" data-go="#/backblast/new">+ New Backblast</button></div>
      <p class="page-sub">Write it, copy it, post it to BAND, Slack or GroupMe.</p>
      <div class="list">${list.map(b => `<button class="row" data-go="#/backblast/${b.id}"><div class="grow">
        <div class="eyebrow">${esc([fmtDate(b.date), aoName(b.aoId)].filter(Boolean).join(" · "))}</div>
        <div class="title">${esc(state.workouts.find(w => w.id === b.workoutId)?.title || b.opening || "Backblast")}</div>
        <div class="sub">${bbCount(b)} PAX · Q: ${esc(b.qs.join(", ") || "—")}</div></div><span class="chev">›</span></button>`).join("") || `<div class="empty">No backblasts yet.</div>`}</div>
    </div>${bottomNav("backblast")}`;
}

function viewBackblast(id, query) {
  let bb = id && id !== "new" ? state.backblasts.find(b => b.id === id) : null;
  if (id && id !== "new" && !bb) { toast("Backblast not found"); return go("#/backblasts"); }
  let persisted = !!bb;
  if (!bb) {
    const w = query.get("w") ? state.workouts.find(x => x.id === query.get("w")) : null;
    bb = {
      id: uid("b"), workoutId: w?.id || "", date: w?.date || todayISO(), aoId: w?.aoId || state.settings.homeAoId || "",
      qs: state.settings.f3Name ? [state.settings.f3Name] : [], pax: [], visitors: [], fngs: [], cot: "",
      openingEdited: false, detailsEdited: false, createdAt: nowIso(),
    };
    refreshAuto(bb);
  } else bb = structuredClone(bb);

  const persist = () => {
    bb.updatedAt = nowIso();
    const idx = state.backblasts.findIndex(x => x.id === bb.id);
    if (idx === -1) state.backblasts.push(structuredClone(bb)); else state.backblasts[idx] = structuredClone(bb);
    if (active && !persisted && location.hash !== `#/backblast/${bb.id}`) history.replaceState(null, "", `#/backblast/${bb.id}`);
    persisted = true; save("backblasts");
  };
  const autosave = debounce(persist, 500);
  let active = true;
  cleanup = () => { active = false; autosave.flush(); };

  /** Who has posted at this AO in the last 3 months, most recent first: the region's attendance
   *  records (data/attendance.js, matched by AO name) plus backblasts saved on this device. */
  const RECENT_DAYS = 92;
  const recentAtAo = () => {
    if (!bb.aoId) return [];
    const ref = bb.date || todayISO();
    const cutoff = new Date(new Date(`${ref}T12:00:00`).getTime() - RECENT_DAYS * 864e5).toISOString().slice(0, 10);
    const last = new Map();
    const note = (name, date) => {
      const key = String(name).trim().toLowerCase();
      if (!key || !date || date < cutoff || date > ref) return;
      const cur = last.get(key);
      if (!cur || cur.date < date) last.set(key, { name: String(name).trim(), date });
    };
    const ao = state.aos.find(a => a.id === bb.aoId);
    const norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
    const sheet = regionAttendance();
    const key = ao && Object.keys(sheet).find(k => norm(k) === norm(ao.name));
    if (key) for (const [name, date] of Object.entries(sheet[key])) note(name, date);
    state.backblasts.filter(b => b.aoId === bb.aoId && b.id !== bb.id).forEach(b => [...b.qs, ...b.pax].forEach(n => note(n, b.date)));
    return [...last.values()].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name))
      .map(x => x.name).filter(n => !inAny(n));
  };
  const inAny = n => [...bb.qs, ...bb.pax, ...bb.visitors, ...bb.fngs].some(x => x.toLowerCase() === n.toLowerCase());
  const addToRoster = names => {
    const add = names.filter(n => !state.roster.some(r => r.toLowerCase() === n.toLowerCase()));
    if (add.length) { state.roster = uniqNames([...state.roster, ...add]).sort((a, b) => a.localeCompare(b)); save("roster"); }
  };

  app().innerHTML = `${topbar("#/backblasts")}
    <div class="page" style="padding-top:4px">
      <h1 class="page-title">Backblast</h1>
      <p class="page-sub" style="font-family:var(--font-display);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:12px">Your edits stay intact while attendance updates automatically.</p>
      <div class="card">
        <div class="two-col">
          <label class="field"><span>Date</span><input class="input" type="date" data-k="date" value="${esc(bb.date)}"></label>
          <label class="field"><span>AO</span><select class="input" data-k="aoId">${aoOptions(bb.aoId)}</select></label>
        </div>
        <label class="field" style="margin:0"><span>Workout</span><select class="input" data-k="workoutId">
          <option value="">None — write details by hand</option>
          ${[...state.workouts].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(w => `<option value="${w.id}" ${w.id === bb.workoutId ? "selected" : ""}>${esc([w.date ? fmtDate(w.date, { month: "short", day: "numeric" }) : "", w.title || "Untitled"].filter(Boolean).join(" — "))}</option>`).join("")}
        </select></label>
      </div>
      <div class="spacer"></div>
      <div class="card" style="background:linear-gradient(160deg,#0d161d,#07090b)">
        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div><div class="field-label" style="color:var(--accent);margin:0">Session roster</div><div style="font-family:var(--font-display);font-weight:700;font-size:22px">ATTENDANCE</div></div>
          <span data-total style="color:var(--good);font-family:var(--font-display);font-weight:700;font-size:13px;letter-spacing:.06em"></span></div>
        <div class="spacer"></div>
        <input class="input" data-search placeholder="Search PAX to add… (Enter adds a new name)" autocomplete="off">
        <div data-suggest></div>
        <div class="spacer"></div>
        <div class="field-label">Q</div><div class="chips" data-list="qs"></div>
        <div class="inline-add"><input class="input" data-addq placeholder="Add a Q / co-Q"><button class="btn sm" data-addq-btn>Add</button></div>
        <div class="field-label" style="margin-top:14px">PAX</div><div class="chips" data-list="pax"></div>
      </div>
      <div class="spacer"></div>
      <div class="card" data-quick></div>
      <div class="att-grid">
        <div class="card"><div class="field-label">Visiting PAX</div><div class="chips" data-list="visitors"></div>
          <div class="inline-add"><input class="input" data-addv placeholder="Name (Region)"><button class="btn sm" data-addv-btn>Add</button></div></div>
        <div class="card"><div class="field-label">FNGs</div><div class="chips" data-list="fngs"></div>
          <div class="inline-add"><input class="input" data-addf placeholder="New F3 name"><button class="btn sm" data-addf-btn>Add</button></div></div>
      </div>
      <div class="label">Backblast</div>
      <div class="list">
        <div class="bb-block"><div class="field-label">Edit opening</div><textarea rows="2" data-edit="opening">${esc(bb.opening)}</textarea></div>
        <div class="bb-block"><div class="field-label live-dot">Live session data</div><div class="bb-live" data-live></div></div>
        <div class="bb-block"><div class="field-label">Edit workout details</div><textarea rows="10" data-edit="details" placeholder="What did you do? Pick a workout above to fill this in.">${esc(bb.details)}</textarea></div>
        <div class="bb-block"><div class="field-label" style="display:flex;justify-content:space-between">COT / Closing <button class="tiny-btn accent" data-cottpl>Insert Saved</button></div>
          <textarea rows="3" data-edit="cot" placeholder="Prayers, praises, moleskin…">${esc(bb.cot)}</textarea></div>
      </div>
      <p class="hint">Heads up for BAND: @tags may not carry over, and text after links can get cut off.</p>
      <div class="btn-grid" style="margin-top:14px">
        <button class="btn primary" data-share>Share Backblast</button>
        <button class="btn" data-copy>Copy Backblast</button>
        <button class="btn" data-reset>Reset</button>
        <button class="btn" data-done>Done</button>
        ${persisted ? `<button class="btn danger full" data-del>Delete Backblast</button>` : ""}
      </div>
    </div>`;

  const ROSTER_PREVIEW = 30;
  let showAllRoster = false;
  const drawLists = () => {
    for (const key of ["qs", "pax", "visitors", "fngs"]) {
      $(`[data-list="${key}"]`).innerHTML = bb[key].map((n, i) => `<button class="chip ${key === "qs" ? "q" : "on"}" data-rm="${key}" data-i="${i}">${key === "qs" ? "Q: " : ""}${esc(n)} <span class="x">×</span></button>`).join("")
        || `<span class="muted" style="font-size:13px">None</span>`;
    }
    const n = bbCount(bb);
    $("[data-total]").textContent = `${n} SELECTED`;
    const recent = recentAtAo();
    const rest = state.roster.filter(r => !inAny(r) && !recent.some(x => x.toLowerCase() === r.toLowerCase()));
    const preview = recent.length ? 0 : ROSTER_PREVIEW;  // with regulars listed, the rest wait behind Show all
    const shown = showAllRoster ? rest : rest.slice(0, preview);
    $("[data-quick]").innerHTML = `
      ${recent.length ? `<div class="field-label">At ${esc(aoName(bb.aoId))} in the last 3 months (${recent.length})</div><div class="chips">${recent.map(r => `<button class="chip" data-quickadd="${esc(r)}">${esc(r)}</button>`).join("")}</div><div class="spacer"></div>` : ""}
      <div class="field-label" style="display:flex;justify-content:space-between">PAX roster (${state.roster.length}) <button class="tiny-btn accent" data-go="#/settings">Edit roster</button></div>
      ${rest.length ? `${shown.length ? `<div class="chips">${shown.map(r => `<button class="chip" data-quickadd="${esc(r)}">${esc(r)}</button>`).join("")}</div><div class="spacer"></div>` : ""}
        ${rest.length > preview ? `<button class="tiny-btn accent" data-roster-more>${showAllRoster ? "Show fewer" : `Show all ${rest.length}${recent.length ? " others" : ""}`}</button><span class="muted" style="font-size:13px"> · or search above</span>` : ""}`
        : `<p class="muted" style="font-size:13px;margin:0">${state.roster.length ? "Everyone on the roster is checked in." : "Your roster is empty. Names you add here are saved to it for quick tap next time."}</p>`}`;
    $("[data-live]").textContent = liveData(bb);
    for (const k of ["opening", "details"]) { const el = $(`[data-edit="${k}"]`); if (document.activeElement !== el && el.value !== bb[k]) el.value = bb[k]; }
  };
  const changed = () => { refreshAuto(bb); drawLists(); autosave(); };
  const addName = (key, raw) => {
    const name = raw.trim().replace(/^@/, "");
    if (!name) return;
    if (inAny(name)) { toast(`${name} is already checked in`); return; }
    bb[key].push(name);
    if (key === "pax" || key === "fngs" || key === "qs") addToRoster([name]);
    changed();
  };

  $$("[data-k]").forEach(el => el.addEventListener("change", () => { bb[el.dataset.k] = el.value; if (el.dataset.k === "workoutId") bb.detailsEdited = false; changed(); }));
  $$("[data-edit]").forEach(el => el.addEventListener("input", () => {
    const k = el.dataset.edit; bb[k] = el.value;
    if (k !== "cot") bb[`${k}Edited`] = true;
    autosave();
  }));
  const search = $("[data-search]");
  const sug = $("[data-suggest]");
  const drawSuggest = () => {
    const q = search.value.trim().toLowerCase();
    if (!q) { sug.innerHTML = ""; return; }
    const hits = state.roster.filter(r => r.toLowerCase().includes(q) && !inAny(r)).slice(0, 8);
    const exact = state.roster.some(r => r.toLowerCase() === q);
    sug.innerHTML = `<div class="suggest">${hits.map(h => `<button data-sug="${esc(h)}">${esc(h)}</button>`).join("")}
      ${exact ? "" : `<button data-sug="${esc(search.value.trim())}">+ Add “${esc(search.value.trim())}” as new PAX</button>`}</div>`;
  };
  search.addEventListener("input", drawSuggest);
  search.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = search.value.trim().toLowerCase();
    const hit = state.roster.find(r => r.toLowerCase() === q) || state.roster.find(r => r.toLowerCase().includes(q) && !inAny(r));
    addName("pax", hit && q ? hit : search.value); search.value = ""; drawSuggest();
  });
  sug.addEventListener("click", e => { const b = e.target.closest("[data-sug]"); if (b) { addName("pax", b.dataset.sug); search.value = ""; drawSuggest(); search.focus(); } });
  const wireInline = (inputSel, btnSel, key) => {
    const input = $(inputSel);
    const add = () => { addName(key, input.value); input.value = ""; input.focus(); };
    $(btnSel).onclick = add;
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); add(); } });
  };
  wireInline("[data-addq]", "[data-addq-btn]", "qs");
  wireInline("[data-addv]", "[data-addv-btn]", "visitors");
  wireInline("[data-addf]", "[data-addf-btn]", "fngs");
  $(".page", app()).addEventListener("click", e => {
    const rm = e.target.closest("[data-rm]");
    if (rm) { bb[rm.dataset.rm].splice(+rm.dataset.i, 1); changed(); return; }
    const qa = e.target.closest("[data-quickadd]");
    if (qa) { addName("pax", qa.dataset.quickadd); return; }
    if (e.target.closest("[data-roster-more]")) { showAllRoster = !showAllRoster; drawLists(); }
  });
  $("[data-cottpl]").onclick = () => insertTemplateModal("cot", t => {
    bb.cot = (bb.cot || "").trim() ? `${bb.cot.trim()}\n\n${t.content}` : t.content; $('[data-edit="cot"]').value = bb.cot; autosave();
  });
  $("[data-copy]").onclick = () => { persist(); copyText(backblastText(bb)); };
  $("[data-share]").onclick = () => { persist(); shareText("Backblast", backblastText(bb)); };
  $("[data-done]").onclick = () => { persist(); toast("Backblast saved"); go("#/backblasts"); };
  $("[data-reset]").onclick = async () => {
    if (!(await confirmModal("Reset the opening and workout details back to the automatic text? Attendance stays.", "Reset", false))) return;
    bb.openingEdited = bb.detailsEdited = false; changed();
  };
  $("[data-del]")?.addEventListener("click", async () => {
    if (!(await confirmModal("Delete this backblast? This can't be undone.", "Delete"))) return;
    autosave.cancel();
    state.backblasts = state.backblasts.filter(x => x.id !== bb.id); save("backblasts"); persisted = false; cleanup = null; go("#/backblasts");
  });
  drawLists();
}

/* ------------------------------------------------------------------ */
/* Library page                                                        */
/* ------------------------------------------------------------------ */
function viewLibrary() {
  app().innerHTML = `${topbar()}
    <div class="page" style="padding-top:4px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <h1 class="page-title">Exicon</h1><button class="btn accent sm" style="border-radius:12px;padding:10px 14px" data-go="#/plan">Plan New Workout</button></div>
      <p class="page-sub">Exercises and thangs from the F3 Nation Exicon and the FiA Lexicon. Use the Library buttons while planning to drop one into your workout.</p>
      <div data-lib-root>${libraryBrowserHtml()}</div>
    </div>${bottomNav("")}`;
  bindLibraryBrowser($("[data-lib-root]"));
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */
function editTemplateModal(section, tpl) {
  openModal(`<h2>${tpl ? "Edit" : "New"} ${esc(SECTION_LABELS[section])} template</h2><button class="tiny-btn modal-close" data-close>Close</button>
    ${tpl && isProgram(tpl) ? `<p class="hint" style="margin-top:0">This came with the app. Once you edit it, app updates won't overwrite your version.</p>` : ""}
    <label class="field"><span>Name</span><input class="input" data-name value="${esc(tpl?.name || "")}"></label>
    <label class="field"><span>Content</span><textarea class="input" data-content style="min-height:200px">${esc(tpl?.content || "")}</textarea></label>
    <div class="btn-row" style="justify-content:flex-end"><button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save</button></div>`,
    (m, close) => $("[data-save]", m).onclick = () => {
      const name = $("[data-name]", m).value.trim();
      const content = $("[data-content]", m).value;
      if (!name) { toast("Name the template"); return; }
      if (tpl) {
        const t = state.templates.find(x => x.id === tpl.id);
        if (t.name !== name || t.content !== content) { Object.assign(t, { name, content, updatedAt: nowIso() }); markEdited(t); }
      } else state.templates.push({ id: uid("t"), section, name, content, source: "user", createdAt: nowIso(), updatedAt: nowIso() });
      save("templates"); close(); viewTemplates();
    });
}
function viewTemplates() {
  app().innerHTML = `${topbar()}
    <div class="page" style="padding-top:4px">
      <h1 class="page-title">My Templates</h1>
      <p class="page-sub">Saved warm-ups, thangs, finishers and notes you can reuse while planning. Items marked <span class="pill prog">Program</span> came with the app — delete any you don't want and they won't come back.</p>
      ${TEMPLATE_SECTIONS.map(sec => {
        const list = state.templates.filter(t => t.section === sec);
        return `<div class="card" style="margin-top:14px">
          <div style="display:flex;justify-content:space-between;align-items:center"><span class="field-label" style="margin:0">${esc(SECTION_LABELS[sec])}</span>
            <button class="round-btn" data-new="${sec}" title="Add">+</button></div>
          ${list.length ? list.map(t => `<div class="template-card"><div class="grow"><strong>${esc(t.name)}</strong> ${isProgram(t) ? `<span class="pill prog">${t.source === "program-edited" ? "Program · edited" : "Program"}</span>` : ""}
            <div class="content">${esc(t.content)}</div></div>
            <div class="acts"><button class="btn sm" data-edit="${t.id}">Edit</button><button class="btn sm danger" data-del="${t.id}">Delete</button></div></div>`).join("")
            : `<p class="muted" style="margin:8px 0 0;font-size:14px">No saved templates yet.</p>`}
        </div>`;
      }).join("")}
    </div>${bottomNav("")}`;
  $$("[data-new]").forEach(b => b.onclick = () => editTemplateModal(b.dataset.new));
  $$("[data-edit]").forEach(b => b.onclick = () => { const t = state.templates.find(x => x.id === b.dataset.edit); editTemplateModal(t.section, t); });
  $$("[data-del]").forEach(b => b.onclick = async () => {
    const t = state.templates.find(x => x.id === b.dataset.del);
    if (!(await confirmModal(`Delete “${t.name}”?${isProgram(t) ? " It came with the app and won't be re-added by future updates (you can restore it in Settings)." : ""}`, "Delete"))) return;
    forgetProgramItem(t);
    state.templates = state.templates.filter(x => x.id !== t.id); save("templates"); viewTemplates();
  });
}

/* ------------------------------------------------------------------ */
/* AOs                                                                 */
/* ------------------------------------------------------------------ */
function editAoModal(ao) {
  openModal(`<h2>${ao ? "Edit AO" : "Add AO"}</h2><button class="tiny-btn modal-close" data-close>Close</button>
    <label class="field"><span>AO name</span><input class="input" data-f="name" value="${esc(ao?.name || "")}" placeholder="The Rock"></label>
    <label class="field"><span>Location</span><input class="input" data-f="location" value="${esc(ao?.location || "")}" placeholder="Granite Regional Park"></label>
    <label class="field"><span>Address</span><input class="input" data-f="address" value="${esc(ao?.address || "")}"></label>
    <label class="field"><span>Schedule</span><input class="input" data-f="schedule" value="${esc(ao?.schedule || "")}" placeholder="Tuesday 5:15am-6:00am"></label>
    <div class="btn-row" style="justify-content:flex-end"><button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save</button></div>`,
    (m, close) => $("[data-save]", m).onclick = () => {
      const vals = Object.fromEntries($$("[data-f]", m).map(i => [i.dataset.f, i.value.trim()]));
      if (!vals.name) { toast("AO needs a name"); return; }
      if (ao) { const a = state.aos.find(x => x.id === ao.id); delete a.hashtag; Object.assign(a, vals, { updatedAt: nowIso() }); markEdited(a); }
      else state.aos.push({ id: uid("ao"), ...vals, source: "user", createdAt: nowIso(), updatedAt: nowIso() });
      save("aos"); close(); viewAos();
    });
}
function viewAos() {
  app().innerHTML = `${topbar()}
    <div class="page" style="padding-top:4px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <h1 class="page-title">AOs</h1><button class="btn accent sm" style="border-radius:12px;padding:10px 14px" data-add>+ Add AO</button></div>
      <p class="page-sub">Add your AOs once. They fill in the location line on every backblast.</p>
      <div class="list">${state.aos.map(a => `<div class="row" style="cursor:default"><div class="grow">
          <div class="title">${esc(a.name)} ${a.id === state.settings.homeAoId ? `<span class="pill good">Home</span>` : ""}${isProgram(a) ? ` <span class="pill prog">Program</span>` : String(a.source || "").startsWith("region") ? ` <span class="pill prog">${esc(state.settings.customRegionName || "Region sheet")}</span>` : ""}</div>
          <div class="sub">${esc([a.location, a.schedule].filter(Boolean).join(" · ") || "No details")}</div></div>
          <button class="btn sm" data-edit="${a.id}">Edit</button><button class="btn sm danger" data-del="${a.id}">Delete</button></div>`).join("") || `<div class="empty">No AOs yet.</div>`}</div>
    </div>${bottomNav("")}`;
  $("[data-add]").onclick = () => editAoModal();
  $$("[data-edit]").forEach(b => b.onclick = () => editAoModal(state.aos.find(a => a.id === b.dataset.edit)));
  $$("[data-del]").forEach(b => b.onclick = async () => {
    const a = state.aos.find(x => x.id === b.dataset.del);
    if (!(await confirmModal(`Delete AO “${a.name}”? Saved workouts and backblasts keep their text but lose the AO link.`, "Delete"))) return;
    forgetProgramItem(a);
    state.aos = state.aos.filter(x => x.id !== a.id);
    if (state.settings.homeAoId === a.id) { state.settings.homeAoId = ""; save("settings"); }
    save("aos"); viewAos();
  });
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */
function regionCardHtml() {
  const s = state.settings, key = regionKey(), c = regionCache;
  const opt = (k, title, desc) => `<label class="switch" style="margin-bottom:10px"><input type="radio" name="region" data-region="${k}" ${key === k ? "checked" : ""}>
    <span><b>${title}</b><br><span class="muted" style="font-size:13px">${desc}</span></span></label>`;
  const id = sheetIdFromUrl(s.customSheetUrl);
  const status = key !== "custom" ? "" : !s.customSheetUrl ? "" : !id ? `<p class="hint" style="color:var(--danger)">That doesn't look like a Google Sheets link. It should contain /spreadsheets/d/…</p>`
    : c?.sheetId !== id ? `<p class="hint">Not loaded yet.</p>`
    : `<p class="hint" ${c.error ? `style="color:var(--danger)"` : ""}>${c.error ? esc(c.error) : `Loaded ${esc(fmtWhen(c.fetchedAt))}: ${c.aos.length} AO${c.aos.length === 1 ? "" : "s"}, ${c.roster.length} PAX, attendance at ${Object.keys(c.attendance).length} AO${Object.keys(c.attendance).length === 1 ? "" : "s"}.`}
      ${!c.error && c.missing?.length ? ` No ${c.missing.map(esc).join(", ")} tab found.` : ""}</p>`;
  return `
    <div class="field-label" style="color:var(--accent)">Region</div>
    <p class="muted" style="font-size:14px;margin:0 0 12px">Your region supplies the AOs, the PAX roster and who has been at each AO lately (shown first on backblasts).</p>
    ${REGIONS.map(r => opt(r.key, esc(r.name), `AOs, PAX roster and attendance from the <a href="${r.sheet}" target="_blank" rel="noopener">${esc(r.name)} data sheet</a>, updated weekly.`)).join("")}
    ${opt("custom", "Custom Google Sheet", "Use your region's own sheet. It's read from your browser, and re-read every few hours.")}
    ${key === "custom" ? `<div style="margin:0 0 12px 32px">
      <label class="field"><span>Region name</span><input class="input" data-custom="customRegionName" value="${esc(s.customRegionName)}" placeholder="Region Name"></label>
      <label class="field"><span>Google Sheet link</span><input class="input" data-custom="customSheetUrl" value="${esc(s.customSheetUrl)}" placeholder="https://docs.google.com/spreadsheets/d/…" inputmode="url" autocomplete="off"></label>
      <div class="btn-row"><button class="btn sm accent" data-region-load>${c?.sheetId === id && !c?.error ? "Reload sheet" : "Load sheet"}</button></div>
      ${status}
      <p class="hint">Lay the sheet out like the <a href="${REGIONS[0].sheet}" target="_blank" rel="noopener">F3 SacTown data sheet</a>: a <b>Roster</b> tab with an "F3 Name" column, a <b>Master Data</b> tab with "Post Date", "AO Name" and "PAX Name" (one row per PAX per workout), and a <b>Sites</b> tab with "AO Name", "Day", "Location", "Time", "Address" and "Retired". Any tab can be left out. Share it as “Anyone with the link” can view.</p>
    </div>` : ""}
    ${opt("none", "None", "No region data. Add your own AOs and PAX.")}
    <p class="hint">Switching region takes away the AOs and roster names the old region added. AOs you edited stay.</p>`;
}
function bindRegionCard(card) {
  const redraw = () => { card.innerHTML = regionCardHtml(); bindRegionCard(card); };
  $$("[data-region]", card).forEach(el => el.onchange = async () => {
    const next = el.dataset.region;
    if (next !== regionKey() && regionKey() !== "none"
      && !(await confirmModal(`Switch region? The AOs and roster names that ${state.settings.regionName || "your region"} added are taken away. AOs you edited stay.`, "Switch"))) { redraw(); return; }
    await setRegion(next);
    toast(next === "none" ? "No region selected" : `Region: ${state.settings.regionName || "Custom"}`);
    viewSettings();
  });
  $$("[data-custom]", card).forEach(el => el.addEventListener("change", async () => {
    const s = state.settings, k = el.dataset.custom;
    s[k] = el.value.trim();
    if (k === "customRegionName" && s.customRegionName) s.regionName = s.customRegionName;
    save("settings");
    if (k === "customSheetUrl" && sheetIdFromUrl(s.customSheetUrl)) { await loadCustom(); return; }
    viewSettings();
  }));
  const loadCustom = async () => {
    const b = $("[data-region-load]", card); if (b) { b.disabled = true; b.textContent = "Loading…"; }
    const c = await refreshCustomRegion({ force: true });
    toast(c && !c.error ? "Sheet loaded" : "Couldn't load the sheet");
    viewSettings();
  };
  const load = $("[data-region-load]", card);
  if (load) load.onclick = () => {
    const url = $('[data-custom="customSheetUrl"]', card).value.trim();
    if (url !== state.settings.customSheetUrl) { state.settings.customSheetUrl = url; save("settings"); }
    if (!sheetIdFromUrl(url)) { toast("Paste a Google Sheets link first"); return; }
    loadCustom();
  };
}
function viewSettings(query) {
  const s = state.settings;
  const p = state.program;
  const progCount = [...state.templates, ...state.aos, ...state.workouts].filter(x => x.source === "program").length;
  app().innerHTML = `${topbar()}
    <div class="page" style="padding-top:4px">
      <h1 class="page-title">Settings</h1>
      <p class="page-sub">Saved in this browser on this device only — use Import / Export to back up or move your data.</p>
      <div class="card" data-region-card>${regionCardHtml()}</div>
      <div class="card">
        <div class="field-label" style="color:var(--accent)">You &amp; your region</div>
        <div class="two-col">
          <label class="field"><span>Your PAX Name</span><input class="input" data-s="f3Name" value="${esc(s.f3Name)}" placeholder="PAX Name"></label>
          <label class="field"><span>Region name</span><input class="input" data-s="regionName" value="${esc(regionNameSet() ? s.regionName : "")}" placeholder="Region Name"></label>
        </div>
        <label class="field" style="margin:0"><span>Home AO</span><select class="input" data-s="homeAoId">${aoOptions(s.homeAoId)}</select></label>
        <p class="hint"><button class="linkish" data-go="#/aos">Manage AOs ›</button></p>
        <div class="field" style="margin:14px 0 0"><span class="field-label">Logo</span>
          <div class="logo-row">
            <div class="logo-preview">${s.logo ? `<img src="${esc(s.logo)}" alt="Logo">` : `<span class="muted">None</span>`}</div>
            <div class="btn-row">
              <label class="btn sm" style="cursor:pointer">${s.logo ? "Change logo" : "Upload logo"}<input type="file" accept="image/*" data-logo hidden></label>
              ${s.logo ? `<button class="btn sm danger" data-logo-remove>Remove</button>` : ""}
            </div>
          </div>
          <p class="hint">Shown at the top left of the home page, next to the region name. PNG with a transparent background looks best.</p>
        </div>
      </div>
      <div class="card">
        <div class="field-label" style="color:var(--accent)">Backblast defaults</div>
        <label class="field"><span>Default why</span><input class="input" data-s="defaultWhy" value="${esc(s.defaultWhy)}"></label>
        <label class="field" style="margin:0"><span>Opening line</span><input class="input" data-s="openingTemplate" value="${esc(s.openingTemplate)}"></label>
        <p class="hint">Placeholders: {count} {ao} {why} {date} {q}.</p>
      </div>
      <div class="card">
        <div class="field-label" style="color:var(--accent);display:flex;justify-content:space-between">PAX roster <span class="pill">${state.roster.length}</span></div>
        <textarea class="input" data-roster placeholder="One F3 name per line" style="min-height:180px">${esc(state.roster.join("\n"))}</textarea>
        <p class="hint">One name per line. Used for quick-tap attendance on backblasts. New names you add on a backblast land here automatically.</p>
      </div>
      <div class="card">
        <div class="field-label" style="color:var(--accent)">Exicon library sources</div>
        <p class="muted" style="font-size:14px;margin:0 0 12px">Choose which exercises and thangs show up when you open the Exicon library or press Library while planning your Q. All sources are on to start.</p>
        ${LIBRARY_SOURCES.map(x => `<label class="switch" style="margin-bottom:10px"><input type="checkbox" data-libsrc="${x.key}" ${enabledLibrarySources().includes(x.key) ? "checked" : ""}>
          <span><span class="pill ${x.pill}">${x.label}</span><br><span class="muted" style="font-size:13px">${x.desc}</span></span></label>`).join("")}
      </div>
      <div class="card">
        <div class="field-label" style="color:var(--accent)">Program content</div>
        <p class="muted" style="font-size:14px;margin:0 0 12px">The app ships with starter templates and a sample workout, and can add more when it updates. Anything you delete stays deleted; anything you edit is yours and won't be overwritten.</p>
        <label class="switch"><input type="checkbox" data-ignore ${s.ignoreProgram ? "checked" : ""}>
          <span><b>Ignore new program content</b><br><span class="muted" style="font-size:13px">When the app updates, don't add or change templates, AOs or sample workouts.</span></span></label>
        <p class="hint">Program content version: ${esc(p.version || "—")}${p.latestVersion && p.latestVersion !== p.version ? ` · available: ${esc(p.latestVersion)}` : ""} · ${progCount} unedited program item${progCount === 1 ? "" : "s"} in your lists · ${p.removed.length} removed</p>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn sm" data-progremove ${progCount ? "" : "disabled"}>Remove all program items</button>
          <button class="btn sm" data-progrestore ${p.removed.length ? "" : "disabled"}>Restore removed items</button>
          ${s.ignoreProgram && p.latestVersion && p.latestVersion !== p.version ? `<button class="btn sm accent" data-progpull>Get ${esc(p.latestVersion)} content now</button>` : ""}
        </div>
      </div>
      <div class="card">
        <div class="field-label" style="color:var(--accent)">Data</div>
        <div class="btn-row"><button class="btn" data-go="#/data">Import / Export</button></div>
        <p class="hint">App ${APP_VERSION} · Exercise library: F3 Nation Exicon and FiA Lexicon${libraryCache ? ` (${libraryCache.count} entries, built ${esc(libraryCache.builtAt)})` : ""}</p>
      </div>
    </div>${bottomNav("")}`;
  if (!libraryCache) loadLibrary().catch(() => {});
  bindRegionCard($("[data-region-card]"));
  const focus = query?.get?.("focus");  // from the home page's "Choose region" / "Set your nickname" buttons
  if (focus) setTimeout(() => {
    const el = focus === "region" ? $("[data-region-card]") : $(`[data-s="${focus}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (el?.matches("input")) el.focus({ preventScroll: true });
  }, 50);
  const saveS = debounce(() => save("settings"), 300);
  $$("[data-s]").forEach(el => el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => { s[el.dataset.s] = el.value; saveS(); }));
  const saveRoster = debounce(() => { state.roster = uniqNames($("[data-roster]").value.split("\n")); save("roster"); }, 400);
  $("[data-roster]").addEventListener("input", saveRoster);
  cleanup = () => { saveS.flush(); saveRoster.flush(); };
  $("[data-logo]").onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try { s.logo = await imageToDataUrl(file, 400); save("settings"); toast("Logo saved"); viewSettings(); }
    catch { toast("Couldn't read that image. Try a PNG or JPG."); }
  };
  $("[data-logo-remove]")?.addEventListener("click", () => { s.logo = ""; save("settings"); toast("Logo removed"); viewSettings(); });
  $$("[data-libsrc]").forEach(el => el.onchange = () => {
    const on = $$("[data-libsrc]").filter(x => x.checked).map(x => x.dataset.libsrc);
    if (!on.length) { el.checked = true; toast("Keep at least one library source turned on"); return; }
    s.libraryHiddenSources = LIBRARY_SOURCES.map(x => x.key).filter(k => !on.includes(k)); save("settings");
  });
  $("[data-ignore]").onchange = e => { s.ignoreProgram = e.target.checked; save("settings"); toast(e.target.checked ? "New program content will be ignored" : "Program updates turned on"); if (!e.target.checked) syncProgram().then(() => viewSettings()); };
  $("[data-progremove]").onclick = async () => {
    if (!(await confirmModal("Remove every unedited template, AO and sample workout that came with the app? Items you've edited are kept. Future updates won't re-add these.", "Remove"))) return;
    for (const coll of PROGRAM_COLLECTIONS) {
      state[coll].filter(x => x.source === "program").forEach(forgetProgramItem);
      state[coll] = state[coll].filter(x => x.source !== "program");
    }
    save(...PROGRAM_COLLECTIONS); toast("Program items removed"); viewSettings();
  };
  $("[data-progrestore]").onclick = async () => {
    const ids = [...p.removed];
    p.removed = []; ids.forEach(id => delete p.hashes[id]); save("program");
    const r = await syncProgram({ force: true });
    p.notice = null; save("program");
    toast(r ? `Restored ${r.added} item${r.added === 1 ? "" : "s"}` : "Couldn't reach program content"); viewSettings();
  };
  $("[data-progpull]")?.addEventListener("click", async () => { const r = await syncProgram({ force: true }); p.notice = null; save("program"); toast(`${r?.added || 0} added, ${r?.updated || 0} updated`); viewSettings(); });
}

/** Shrink an uploaded image so it fits comfortably in browser storage. */
function imageToDataUrl(file, maxSide) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth || maxSide, h = img.naturalHeight || maxSide;
      const scale = Math.min(1, maxSide / Math.max(w, h));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

/* ------------------------------------------------------------------ */
/* Import / Export                                                     */
/* ------------------------------------------------------------------ */
const DATA_KINDS = [
  { key: "settings", label: "Settings", desc: "Region, F3 name, logo, backblast defaults, program-content choices" },
  { key: "roster", label: "PAX roster", desc: "Names for quick-tap attendance" },
  { key: "aos", label: "AOs", desc: "Locations and schedules" },
  { key: "templates", label: "Saved templates", desc: "Intro, warm-up, thang, Mary, notes, COT" },
  { key: "workouts", label: "Saved workouts", desc: "Plans and drafts" },
  { key: "backblasts", label: "Backblasts", desc: "Attendance and backblast text" },
];
function kindCount(key, data, includeProgram = true) {
  const v = data[key];
  if (key === "settings") return v ? "" : 0;
  if (!Array.isArray(v)) return 0;
  return (includeProgram || key === "roster" ? v : v.filter(x => x.source !== "program")).length;
}
function viewData() {
  app().innerHTML = `${topbar("#/settings")}
    <div class="page" style="padding-top:4px">
      <h1 class="page-title">Import / Export</h1>
      <p class="page-sub">Back up your data, move it to another phone, or share templates and AOs with another Q.</p>
      <div class="card">
        <div class="field-label" style="color:var(--accent)">Export</div>
        <div class="check-list" data-exp>${DATA_KINDS.map(k => `<label><input type="checkbox" value="${k.key}" checked>
          <span><b>${k.label}</b><br><span class="muted" style="font-size:12.5px">${k.desc}</span></span><span class="count" data-c="${k.key}"></span></label>`).join("")}</div>
        <div class="spacer"></div>
        <label class="switch"><input type="checkbox" data-incprog><span>Include unedited program items<br><span class="muted" style="font-size:13px">Usually not needed — they come with the app.</span></span></label>
        <div class="spacer"></div>
        <div class="btn-row"><button class="btn primary" data-export>Download backup file</button><button class="btn sm ghost" data-all>Select all</button><button class="btn sm ghost" data-none>Select none</button></div>
      </div>
      <div class="card">
        <div class="field-label" style="color:var(--accent)">Import</div>
        <input type="file" accept=".json,application/json" class="input" data-file>
        <div data-imp></div>
      </div>
    </div>${bottomNav("")}`;

  const incProg = $("[data-incprog]");
  const drawCounts = () => DATA_KINDS.forEach(k => { const c = kindCount(k.key, state, incProg.checked); $(`[data-c="${k.key}"]`).textContent = c === "" ? "" : c; });
  incProg.onchange = drawCounts; drawCounts();
  $("[data-all]").onclick = () => $$("[data-exp] input").forEach(i => (i.checked = true));
  $("[data-none]").onclick = () => $$("[data-exp] input").forEach(i => (i.checked = false));
  $("[data-export]").onclick = () => {
    const keys = $$("[data-exp] input:checked").map(i => i.value);
    if (!keys.length) { toast("Pick at least one thing to export"); return; }
    const data = {};
    for (const k of keys) {
      if (k === "settings") data.settings = { ...state.settings, programRemoved: state.program.removed };
      else if (k === "roster") data.roster = [...state.roster];
      else data[k] = state[k].filter(x => incProg.checked || x.source !== "program");
    }
    const payload = { app: "f3-q-planner", schema: 1, appVersion: APP_VERSION, exportedAt: nowIso(), data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `f3-q-planner-${keys.length === DATA_KINDS.length ? "backup" : keys.join("-")}-${todayISO()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Backup downloaded");
  };

  $("[data-file]").onchange = async e => {
    const file = e.target.files[0];
    const box = $("[data-imp]");
    if (!file) { box.innerHTML = ""; return; }
    let payload;
    try { payload = JSON.parse(await file.text()); } catch { box.innerHTML = `<p class="hint" style="color:var(--danger)">That file isn't valid JSON.</p>`; return; }
    const data = payload?.data;
    if (payload?.app !== "f3-q-planner" || !data) { box.innerHTML = `<p class="hint" style="color:var(--danger)">That doesn't look like an F3 Q Planner export.</p>`; return; }
    const present = DATA_KINDS.filter(k => data[k.key] !== undefined);
    box.innerHTML = `
      <p class="hint">Exported ${esc(payload.exportedAt ? new Date(payload.exportedAt).toLocaleString() : "")}. Choose what to bring in:</p>
      <div class="check-list">${present.map(k => `<label><input type="checkbox" value="${k.key}" checked><span><b>${k.label}</b></span><span class="count">${kindCount(k.key, data)}</span></label>`).join("")}</div>
      <div class="spacer"></div>
      <div class="field-label">How</div>
      <div class="check-list">
        <label><input type="radio" name="mode" value="merge" checked><span><b>Merge</b><br><span class="muted" style="font-size:12.5px">Add new items and update ones with the same ID. Keeps everything else.</span></span></label>
        <label><input type="radio" name="mode" value="replace"><span><b>Replace</b><br><span class="muted" style="font-size:12.5px">Wipe the selected categories here, then load the file's.</span></span></label>
      </div>
      <div class="spacer"></div>
      <button class="btn primary" data-doimport>Import selected</button>`;
    $("[data-doimport]", box).onclick = async () => {
      const keys = $$(".check-list input[type=checkbox]:checked", box).map(i => i.value);
      const mode = $("input[name=mode]:checked", box).value;
      if (!keys.length) { toast("Pick at least one thing to import"); return; }
      if (mode === "replace" && !(await confirmModal(`Replace your ${keys.map(k => DATA_KINDS.find(d => d.key === k).label.toLowerCase()).join(", ")} with the file's?`, "Replace"))) return;
      const summary = [];
      for (const k of keys) {
        if (k === "settings") {
          const { programRemoved, hashtags: _drop, ...rest } = data.settings || {};
          state.settings = { ...DEFAULT_SETTINGS, ...(mode === "merge" ? state.settings : {}), ...rest };
          if (Array.isArray(programRemoved)) state.program.removed = mode === "merge" ? [...new Set([...state.program.removed, ...programRemoved])] : programRemoved;
          save("settings", "program"); summary.push("settings");
        } else if (k === "roster") {
          state.roster = uniqNames(mode === "merge" ? [...state.roster, ...(data.roster || [])] : data.roster || []).sort((a, b) => a.localeCompare(b));
          save("roster"); summary.push(`${data.roster?.length || 0} PAX`);
        } else {
          const incoming = (data[k] || []).filter(x => x && x.id);
          if (mode === "replace") state[k] = incoming.map(x => normalizeItem(k, x));
          else for (const item of incoming) {
            const i = state[k].findIndex(x => x.id === item.id);
            if (i === -1) state[k].push(normalizeItem(k, item)); else state[k][i] = normalizeItem(k, { ...state[k][i], ...item });
          }
          save(k); summary.push(`${incoming.length} ${DATA_KINDS.find(d => d.key === k).label.toLowerCase()}`);
        }
      }
      toast(`Imported ${summary.join(", ")}`);
      viewData();
    };
  };
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
(async function boot() {
  for (const k of COLLECTIONS) if (!Array.isArray(state[k])) state[k] = [];
  if (state.aos.some(a => "hashtag" in a)) { state.aos.forEach(a => delete a.hashtag); save("aos"); }
  if ("hashtags" in state.settings) { delete state.settings.hashtags; save("settings"); }
  if (state.backblasts.some(b => "hashtags" in b || "hashtagsEdited" in b)) {
    state.backblasts.forEach(b => { delete b.hashtags; delete b.hashtagsEdited; }); save("backblasts");
  }
  if (state.settings.regionName === OLD_DEFAULT_REGION_NAME) { state.settings.regionName = DEFAULT_SETTINGS.regionName; save("settings"); }
  if (!state.settings.region) {
    // New installs start with no region. Installs from before regions existed already have the
    // F3 SacTown AOs and roster (they've synced program content), so they stay on F3 SacTown.
    state.settings.region = state.program.version ? "sactown" : "none";
    if (state.settings.region === "sactown" && state.settings.regionName === DEFAULT_SETTINGS.regionName) state.settings.regionName = "F3 SacTown";
    save("settings");
  }
  syncRoster();
  render();
  const r = await syncProgram();
  if (r && (r.added || r.updated)) render();
  if (regionKey() === "custom") refreshCustomRegion().then(c => c && render());
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
