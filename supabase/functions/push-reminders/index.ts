// Rocket's push notifications (Web Push). Called every 5 minutes by the database (pg_cron, see
// the push_notifications migration) to send what's due:
//   - workout reminders for the Q: the day before, before it starts, and for its backblast after;
//   - nudges to finish a draft;
//   - someone liked or reused your workout;
//   - a new PAX in your region joined Rocket.
// Each goes out once (notification_log). The app also calls it for the public key ("key") and to
// send a test to the signed-in user's devices ("test").
//
// Needs the secrets VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (a mailto: address);
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";
import {
  addDays,
  dueReminders,
  normalizeSettings,
  type Notice,
  type ReminderDraft,
  type ReminderWorkout,
} from "../_shared/reminders.ts";

const PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
const DEFAULT_ZONE = "America/Los_Angeles";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

interface Subscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

type Outgoing = Notice & { user_id: string };

const HOUR = 60 * 60 * 1000;

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Sends one notification to every device of its user; drops devices that have gone away. */
async function deliver(
  notice: Outgoing,
  subscriptions: Subscription[],
): Promise<number> {
  let sent = 0;
  const payload = JSON.stringify({
    title: notice.title,
    body: notice.body,
    url: notice.url,
    tag: `${notice.kind}:${notice.ref}`,
  });
  for (const s of subscriptions.filter((s) => s.user_id === notice.user_id)) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 6 * 60 * 60 },
      );
      sent++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      // The browser unsubscribed or the subscription expired.
      if (status === 404 || status === 410)
        await db.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("push failed", status, (error as Error).message);
    }
  }
  return sent;
}

/** Everything due now, for every user with a device signed up. */
async function collect(subscriptions: Subscription[]): Promise<Outgoing[]> {
  const now = Date.now();
  const users = [...new Set(subscriptions.map((s) => s.user_id))];
  if (!users.length) return [];

  const { data: settingsRows, error: settingsError } = await db
    .from("notification_settings")
    .select("user_id, settings, time_zone")
    .in("user_id", users);
  fail(settingsError);
  const prefs = new Map(
    users.map((id) => {
      const row = settingsRows?.find((r) => r.user_id === id);
      return [
        id,
        {
          settings: normalizeSettings(row?.settings),
          timeZone: row?.time_zone || DEFAULT_ZONE,
        },
      ];
    }),
  );

  // Finished workouts from yesterday to two days out (in UTC; each user's own time zone decides).
  const today = new Date(now).toISOString().slice(0, 10);
  const [workouts, drafts, draftBackblasts] = await Promise.all([
    db
      .from("workouts")
      .select("id, author_id, title, ao, date, time")
      .in("author_id", users)
      .eq("status", "published")
      .gte("date", addDays(today, -1))
      .lte("date", addDays(today, 2)),
    db
      .from("workouts")
      .select("id, author_id, title, created_at")
      .in("author_id", users)
      .eq("status", "draft")
      .gte("created_at", new Date(now - 32 * 24 * HOUR).toISOString()),
    db
      .from("backblasts")
      .select("id, author_id, title, created_at")
      .in("author_id", users)
      .eq("status", "draft")
      .gte("created_at", new Date(now - 32 * 24 * HOUR).toISOString()),
  ]);
  fail(workouts.error);
  fail(drafts.error);
  fail(draftBackblasts.error);

  const workoutIds = [
    ...(workouts.data ?? []).map((w) => w.id),
    ...(drafts.data ?? []).map((w) => w.id),
  ];
  const backblastIds = (draftBackblasts.data ?? []).map((b) => b.id);
  const [written, archivedWorkouts, archivedBackblasts] = await Promise.all([
    workoutIds.length
      ? db
          .from("backblasts")
          .select("workout_id, author_id")
          .in("workout_id", workoutIds)
          .eq("status", "published")
      : { data: [], error: null },
    workoutIds.length
      ? db
          .from("workout_archives")
          .select("workout_id, user_id")
          .in("workout_id", workoutIds)
      : { data: [], error: null },
    backblastIds.length
      ? db
          .from("backblast_archives")
          .select("backblast_id, user_id")
          .in("backblast_id", backblastIds)
      : { data: [], error: null },
  ]);
  fail(written.error);
  fail(archivedWorkouts.error);
  fail(archivedBackblasts.error);
  const archived = new Set([
    ...(archivedWorkouts.data ?? []).map(
      (a: { workout_id: string; user_id: string }) =>
        `${a.user_id}:${a.workout_id}`,
    ),
    ...(archivedBackblasts.data ?? []).map(
      (a: { backblast_id: string; user_id: string }) =>
        `${a.user_id}:${a.backblast_id}`,
    ),
  ]);
  const live = <T extends { id: string; author_id: string }>(
    rows: T[] | null,
  ) => (rows ?? []).filter((r) => !archived.has(`${r.author_id}:${r.id}`));

  const out: Outgoing[] = [];
  for (const user of users) {
    const { settings, timeZone } = prefs.get(user)!;
    const mine = <T extends { author_id: string }>(rows: T[]) =>
      rows.filter((r) => r.author_id === user);
    const hasBackblast = new Set(
      (written.data ?? [])
        .filter((b: { author_id: string }) => b.author_id === user)
        .map((b: { workout_id: string }) => b.workout_id),
    );
    const userDrafts: ReminderDraft[] = [
      ...mine(live(drafts.data)).map((d) => ({
        ...d,
        kind: "workout" as const,
      })),
      ...mine(live(draftBackblasts.data)).map((d) => ({
        ...d,
        kind: "backblast" as const,
      })),
    ];
    for (const notice of dueReminders({
      now,
      settings,
      timeZone,
      workouts: mine(live(workouts.data)) as ReminderWorkout[],
      drafts: userDrafts,
      hasBackblast,
    }))
      out.push({ ...notice, user_id: user });
  }

  out.push(...(await social(users, prefs, now)));
  out.push(...(await newPax(users, prefs, now)));
  return out;
}

type Prefs = Map<string, { settings: ReturnType<typeof normalizeSettings> }>;

async function names(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const { data, error } = await db
    .from("profiles")
    .select("id, name")
    .in("id", ids);
  fail(error);
  return new Map((data ?? []).map((p) => [p.id, p.name?.trim() || "A PAX"]));
}

/** Likes and reuses of someone's workouts in the last hour, by other PAX. */
async function social(
  users: string[],
  prefs: Prefs,
  now: number,
): Promise<Outgoing[]> {
  const wanted = users.filter((u) => prefs.get(u)!.settings.social.on);
  if (!wanted.length) return [];
  const since = new Date(now - HOUR).toISOString();
  const [likes, reuses] = await Promise.all([
    db
      .from("workout_likes")
      .select("workout_id, user_id, created_at")
      .gte("created_at", since),
    db
      .from("workouts")
      .select("id, author_id, reused_from")
      .not("reused_from", "is", null)
      .gte("created_at", since),
  ]);
  fail(likes.error);
  fail(reuses.error);
  const targets = [
    ...(likes.data ?? []).map((l) => l.workout_id),
    ...(reuses.data ?? []).map((r) => r.reused_from as string),
  ];
  if (!targets.length) return [];
  const { data: originals, error } = await db
    .from("workouts")
    .select("id, author_id, title")
    .in("id", [...new Set(targets)])
    .in("author_id", wanted);
  fail(error);
  const byId = new Map((originals ?? []).map((w) => [w.id, w]));
  const people = await names([
    ...(likes.data ?? []).map((l) => l.user_id),
    ...(reuses.data ?? []).map((r) => r.author_id),
  ]);
  const out: Outgoing[] = [];
  for (const like of likes.data ?? []) {
    const w = byId.get(like.workout_id);
    if (!w || w.author_id === like.user_id) continue;
    out.push({
      user_id: w.author_id,
      kind: "like",
      ref: `${like.workout_id}:${like.user_id}`,
      title: `${people.get(like.user_id) ?? "A PAX"} liked your workout`,
      body: w.title?.trim() || "Untitled workout",
      url: `workout/?id=${w.id}`,
    });
  }
  for (const reuse of reuses.data ?? []) {
    const w = byId.get(reuse.reused_from as string);
    if (!w || w.author_id === reuse.author_id) continue;
    out.push({
      user_id: w.author_id,
      kind: "reuse",
      ref: reuse.id,
      title: `${people.get(reuse.author_id) ?? "A PAX"} reused your workout`,
      body: w.title?.trim() || "Untitled workout",
      url: `workout/?id=${w.id}`,
    });
  }
  return out;
}

/** PAX who joined Rocket in the last day, told to others in their region (or organization). */
async function newPax(
  users: string[],
  prefs: Prefs,
  now: number,
): Promise<Outgoing[]> {
  const wanted = users.filter((u) => prefs.get(u)!.settings.newPax.on);
  if (!wanted.length) return [];
  const { data: joined, error } = await db
    .from("profiles")
    .select(
      "id, name, created_at, region_id, region:regions!profiles_region_id_fkey(name, language)",
    )
    .gte("created_at", new Date(now - 24 * HOUR).toISOString())
    .not("region_id", "is", null);
  fail(error);
  if (!joined?.length) return [];
  const { data: recipients, error: recipientsError } = await db
    .from("profiles")
    .select("id, region_id, region_scope")
    .in("id", wanted);
  fail(recipientsError);
  const out: Outgoing[] = [];
  for (const pax of joined) {
    const region = pax.region as unknown as {
      name: string;
      language: string;
    } | null;
    if (!pax.name?.trim() || !region) continue;
    for (const r of recipients ?? []) {
      if (r.id === pax.id) continue;
      // Same region, or someone who chose all of that organization's regions.
      if (r.region_id !== pax.region_id && r.region_scope !== region.language)
        continue;
      out.push({
        user_id: r.id,
        kind: "new_pax",
        ref: pax.id,
        title: `${pax.name.trim()} joined Rocket`,
        body: `New in ${region.name}. Say hello at the next workout.`,
        url: `pax/profile/?name=${encodeURIComponent(pax.name.trim())}&org=${region.language}`,
      });
    }
  }
  return out;
}

/** Sends everything due that hasn't gone out before. */
async function run() {
  const { data: subscriptions, error } = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");
  fail(error);
  const due = await collect(subscriptions ?? []);
  if (!due.length) return { due: 0, sent: 0 };
  // Claim each one in the log first, so a second run at the same time can't send it again.
  const { data: claimed, error: claimError } = await db
    .from("notification_log")
    .upsert(
      due.map(({ user_id, kind, ref }) => ({ user_id, kind, ref })),
      { onConflict: "user_id,kind,ref", ignoreDuplicates: true },
    )
    .select("user_id, kind, ref");
  fail(claimError);
  const fresh = due.filter((n) =>
    claimed?.some(
      (c) => c.user_id === n.user_id && c.kind === n.kind && c.ref === n.ref,
    ),
  );
  let sent = 0;
  for (const notice of fresh)
    sent += await deliver(notice, subscriptions ?? []);
  return { due: due.length, new: fresh.length, sent };
}

/** A test notification to the signed-in user's devices. */
async function test(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const { data, error } = await db.auth.getUser(token ?? "");
  if (error || !data.user) return json({ error: "Sign in first." }, 401);
  const { data: subscriptions, error: subsError } = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .eq("user_id", data.user.id);
  fail(subsError);
  const sent = await deliver(
    {
      user_id: data.user.id,
      kind: "test",
      ref: String(Date.now()),
      title: "Rocket notifications are on",
      body: "This is how Rocket's reminders will look on this device.",
      url: "settings/",
    },
    subscriptions ?? [],
  );
  return json({ sent });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const { action } = (await req.json().catch(() => ({}))) as {
    action?: string;
  };
  // The browser needs the public key to sign a device up; it's public by design.
  if (action === "key") return json({ publicKey: PUBLIC_KEY || null });
  if (!PUBLIC_KEY || !PRIVATE_KEY)
    return json({ error: "Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY." }, 500);
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  try {
    if (action === "test") return await test(req);
    return json(await run());
  } catch (error) {
    console.error(error);
    return json({ error: (error as Error).message }, 500);
  }
});
