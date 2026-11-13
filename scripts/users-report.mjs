#!/usr/bin/env node
/**
 * Daily users email (run by .github/workflows/users-report.yml).
 *
 * Reads every Rocket account from the production Supabase project and emails a summary: the
 * accounts that joined in the last 24 hours, then all of them, each with their name, region,
 * email (masked to its first and last 6 characters), when they joined, and their finished
 * workouts and backblasts and the likes and reuses other PAX gave their finished workouts.
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and to send: REPORT_SMTP_USER and
 * REPORT_SMTP_PASSWORD (for Gmail, the address and an app password) and REPORT_EMAIL_TO.
 * REPORT_SMTP_HOST and REPORT_SMTP_PORT default to Gmail's (smtp.gmail.com, 465). With
 * REPORT_OUT set, the email is written to that file instead of sent (for trying it out).
 */

import tls from "node:tls";
import { writeFileSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL.trim()).origin
  : "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const OUT = process.env.REPORT_OUT;
const SMTP = {
  host: process.env.REPORT_SMTP_HOST?.trim() || "smtp.gmail.com",
  port: Number(process.env.REPORT_SMTP_PORT) || 465,
  user: process.env.REPORT_SMTP_USER?.trim(),
  pass: process.env.REPORT_SMTP_PASSWORD?.replace(/\s+/g, ""),
  to: process.env.REPORT_EMAIL_TO?.trim(),
};

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_KEY)
  fail(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to build the users email.",
  );
if (!OUT && (!SMTP.user || !SMTP.pass || !SMTP.to))
  fail(
    "Set the REPORT_SMTP_USER, REPORT_SMTP_PASSWORD and REPORT_EMAIL_TO secrets to send the users email.",
  );

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

async function get(path) {
  const response = await fetch(`${SUPABASE_URL}${path}`, { headers });
  if (!response.ok)
    throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

/** Every row of a table (with the columns asked for), a page at a time. */
async function rows(table, query) {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await get(
      `/rest/v1/${table}?${query}&limit=1000&offset=${offset}`,
    );
    all.push(...page);
    if (page.length < 1000) return all;
  }
}

/** Every account, from Supabase Auth's admin API. */
async function users() {
  const all = [];
  for (let page = 1; ; page++) {
    const { users } = await get(
      `/auth/v1/admin/users?page=${page}&per_page=1000`,
    );
    all.push(...users);
    if (users.length < 1000) return all;
  }
}

/** "jonath…il.com": the first and last 6 characters, so the address can't be read back whole. */
export function maskEmail(email) {
  if (!email) return "—";
  return email.length > 12
    ? `${email.slice(0, 6)}…${email.slice(-6)}`
    : `${email.slice(0, 2)}…`;
}

const count = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

async function report() {
  const [accounts, workouts, backblasts, likes, profiles, regions] =
    await Promise.all([
      users(),
      rows("workouts", "select=id,author_id,status,reused_from"),
      rows("backblasts", "select=author_id&status=eq.published"),
      rows("workout_likes", "select=workout_id"),
      rows("profiles", "select=id,region_id,region_scope"),
      rows("regions", "select=id,name"),
    ]);

  const finished = new Map(
    workouts.filter((w) => w.status === "published").map((w) => [w.id, w]),
  );
  const workoutCount = new Map();
  for (const w of finished.values()) count(workoutCount, w.author_id);
  const backblastCount = new Map();
  for (const b of backblasts) count(backblastCount, b.author_id);
  // Likes and reuses are what others gave someone's finished workouts, as the app counts them.
  const likeCount = new Map();
  for (const l of likes) {
    const w = finished.get(l.workout_id);
    if (w) count(likeCount, w.author_id);
  }
  const reuseCount = new Map();
  for (const r of workouts) {
    const w = r.reused_from && finished.get(r.reused_from);
    if (w && r.author_id !== w.author_id) count(reuseCount, w.author_id);
  }
  const regionName = new Map(regions.map((r) => [r.id, r.name]));
  const profile = new Map(profiles.map((p) => [p.id, p]));
  const scope = { f3: "All F3 regions", fia: "All FiA regions" };

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const people = accounts
    .map((u) => {
      const meta = u.user_metadata ?? {};
      const p = profile.get(u.id);
      return {
        name: (meta.f3_name || meta.name || "").trim() || "(no name)",
        region: regionName.get(p?.region_id) ?? scope[p?.region_scope] ?? "—",
        email: maskEmail(u.email),
        created: new Date(u.created_at),
        workouts: workoutCount.get(u.id) ?? 0,
        backblasts: backblastCount.get(u.id) ?? 0,
        likes: likeCount.get(u.id) ?? 0,
        reuses: reuseCount.get(u.id) ?? 0,
      };
    })
    .sort((a, b) => b.created - a.created);
  return {
    people,
    fresh: people.filter((p) => p.created.getTime() > dayAgo),
  };
}

const PACIFIC = "America/Los_Angeles";
const joined = (date) =>
  date.toLocaleDateString("en-CA", { timeZone: PACIFIC }); // YYYY-MM-DD
const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const COLUMNS = [
  ["Name", (p) => p.name],
  ["Region", (p) => p.region],
  ["Email", (p) => p.email],
  ["Joined", (p) => joined(p.created)],
  ["Workouts", (p) => p.workouts, true],
  ["Backblasts", (p) => p.backblasts, true],
  ["Likes", (p) => p.likes, true],
  ["Reuses", (p) => p.reuses, true],
];
const FOOTNOTE =
  "Workouts and backblasts count finished ones; likes and reuses are what other PAX gave this user's finished workouts. Production only (not rocket-dev).";

function htmlTable(people) {
  if (!people.length) return "<p>No new users.</p>";
  const cell = "border:1px solid #ccc;padding:4px 8px;";
  const head = COLUMNS.map(
    ([title, , number]) =>
      `<th style="${cell}background:#f3f3f3;text-align:${number ? "right" : "left"}">${title}</th>`,
  ).join("");
  const body = people
    .map(
      (p) =>
        `<tr>${COLUMNS.map(
          ([, value, number]) =>
            `<td style="${cell}${number ? "text-align:right" : ""}">${escape(value(p))}</td>`,
        ).join("")}</tr>`,
    )
    .join("");
  return `<table style="border-collapse:collapse;font-size:13px"><tr>${head}</tr>${body}</table>`;
}

function textTable(people) {
  if (!people.length) return "No new users.";
  return people
    .map((p) =>
      COLUMNS.map(([title, value]) => `${title}: ${value(p)}`).join(" · "),
    )
    .join("\n");
}

function email({ people, fresh }) {
  const sum = (key) => people.reduce((n, p) => n + p[key], 0);
  const date = new Date().toLocaleDateString("en-US", {
    timeZone: PACIFIC,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const totals = `${people.length} users, ${fresh.length} new in the last 24 hours · ${sum("workouts")} workouts, ${sum("backblasts")} backblasts, ${sum("likes")} likes, ${sum("reuses")} reuses`;
  return {
    subject: `Rocket users – ${date} – ${fresh.length} new, ${people.length} total`,
    html: `<div style="font-family:Arial,sans-serif;color:#222">
<h2 style="margin:0 0 4px">Rocket users</h2>
<p style="margin:0 0 16px">${escape(totals)}</p>
<h3 style="margin:16px 0 6px">New in the last 24 hours</h3>
${htmlTable(fresh)}
<h3 style="margin:16px 0 6px">All users</h3>
${htmlTable(people)}
<p style="margin-top:16px;font-size:12px;color:#666">${escape(FOOTNOTE)}</p>
</div>`,
    text: `Rocket users\n${totals}\n\nNew in the last 24 hours\n${textTable(fresh)}\n\nAll users\n${textTable(people)}\n\n${FOOTNOTE}\n`,
  };
}

/** Base64 in 76-character lines, as email bodies are sent. */
const base64Lines = (text) =>
  Buffer.from(text, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");

function message({ subject, html, text }) {
  const boundary = `rocket-${Date.now().toString(36)}`;
  return [
    `From: Rocket <${SMTP.user}>`,
    `To: ${SMTP.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/** Sends one message over SMTP with TLS (port 465) and AUTH LOGIN, as Gmail takes it. */
async function send(mail) {
  const socket = tls.connect({
    host: SMTP.host,
    port: SMTP.port,
    servername: SMTP.host,
  });
  socket.setTimeout(30_000, () => socket.destroy(new Error("SMTP timed out")));
  let buffer = "";
  const waiting = [];
  let failure = null;
  const settle = () => {
    while (waiting.length) {
      if (failure) return waiting.shift().reject(failure);
      // A reply ends with a line like "250 OK" (earlier lines of it read "250-...").
      const end = buffer.match(/(?:^|\r\n)\d{3} [^\r\n]*\r\n/);
      if (!end) return;
      const length = end.index + end[0].length;
      const reply = buffer.slice(0, length);
      buffer = buffer.slice(length);
      waiting.shift().resolve(reply);
    }
  };
  socket.on("data", (chunk) => {
    buffer += chunk;
    settle();
  });
  socket.on("error", (error) => {
    failure = error;
    settle();
  });
  const reply = () =>
    new Promise((resolve, reject) => {
      waiting.push({ resolve, reject });
      settle();
    });
  const step = async (line, expect, shown = line) => {
    if (line !== null) socket.write(`${line}\r\n`);
    const answer = await reply();
    if (!answer.startsWith(expect))
      throw new Error(`SMTP ${shown ?? "greeting"}: ${answer.trim()}`);
  };
  const b64 = (text) => Buffer.from(text, "utf8").toString("base64");
  try {
    await step(null, "220");
    await step("EHLO rocket", "250");
    await step("AUTH LOGIN", "334");
    await step(b64(SMTP.user), "334", "(username)");
    await step(b64(SMTP.pass), "235", "(password)");
    await step(`MAIL FROM:<${SMTP.user}>`, "250");
    for (const to of SMTP.to
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean))
      await step(`RCPT TO:<${to}>`, "250", "RCPT TO");
    await step("DATA", "354");
    // A line starting with "." is doubled, so it isn't read as the end of the message.
    await step(
      `${message(mail).replace(/\r\n\./g, "\r\n..")}\r\n.`,
      "250",
      "(message)",
    );
    await step("QUIT", "221");
  } finally {
    socket.end();
  }
}

const data = await report();
const mail = email(data);
console.log(
  `${data.people.length} users, ${data.fresh.length} new in the last 24 hours.`,
);
if (OUT) {
  writeFileSync(
    OUT,
    `Subject: ${mail.subject}\n\n${mail.html}\n\n${mail.text}`,
  );
  console.log(`Wrote the email to ${OUT}.`);
} else {
  await send(mail);
  console.log("Sent the users email.");
}
