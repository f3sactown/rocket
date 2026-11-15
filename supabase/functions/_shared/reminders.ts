/**
 * When Rocket's push notifications are due. Pure functions with no imports, so the Edge Function
 * (Deno) and the unit tests (Node, in packages/core) share them. The web app keeps a copy of the
 * settings defaults in apps/web/src/lib/notification-settings.ts; keep the two in step.
 */

/** Each kind of notification's on/off switch and timing, as saved per user. */
export interface NotificationSettings {
  /** The day before a workout, at a time of day ("06:00"). */
  dayBefore: { on: boolean; time: string };
  /** On the workout's day, this many minutes before it starts. */
  morningOf: { on: boolean; minutes: number };
  /** This many minutes after a workout ends, if it has no backblast yet. */
  backblast: { on: boolean; minutes: number };
  /** Nudges to finish a draft, each this many days after it was started. */
  drafts: { on: boolean; days: number }[];
  /** Someone liked or reused one of your workouts. */
  social: { on: boolean };
  /** A new PAX in your region joined Rocket. */
  newPax: { on: boolean };
}

export const DEFAULT_SETTINGS: NotificationSettings = {
  dayBefore: { on: true, time: "06:00" },
  morningOf: { on: true, minutes: 40 },
  backblast: { on: true, minutes: 30 },
  drafts: [
    { on: true, days: 2 },
    { on: false, days: 4 },
    { on: false, days: 6 },
  ],
  social: { on: true },
  newPax: { on: true },
};

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
const flag = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;
type Loose = Record<string, unknown> | undefined;

/** Saved settings with anything missing or out of range replaced by its default. */
export function normalizeSettings(saved: unknown): NotificationSettings {
  const s = (saved && typeof saved === "object" ? saved : {}) as Record<
    string,
    Loose
  >;
  const d = DEFAULT_SETTINGS;
  const time =
    typeof s.dayBefore?.time === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(s.dayBefore.time)
      ? s.dayBefore.time
      : d.dayBefore.time;
  const drafts = Array.isArray(s.drafts) ? (s.drafts as Loose[]) : [];
  return {
    dayBefore: { on: flag(s.dayBefore?.on, d.dayBefore.on), time },
    morningOf: {
      on: flag(s.morningOf?.on, d.morningOf.on),
      minutes: clamp(s.morningOf?.minutes, 5, 240, d.morningOf.minutes),
    },
    backblast: {
      on: flag(s.backblast?.on, d.backblast.on),
      minutes: clamp(s.backblast?.minutes, 0, 720, d.backblast.minutes),
    },
    drafts: d.drafts.map((nudge, i) => ({
      on: flag(drafts[i]?.on, nudge.on),
      days: clamp(drafts[i]?.days, 1, 30, nudge.days),
    })),
    social: { on: flag(s.social?.on, d.social.on) },
    newPax: { on: flag(s.newPax?.on, d.newPax.on) },
  };
}

/** Minutes past midnight from a clock time like "5:15am", "5:15 AM", "5am", "05:15" or "17:30". */
export function parseClock(text: string): number | null {
  const m = text
    .trim()
    .match(/^(\d{1,2})(?::?(\d{2}))?\s*(a\.?m?\.?|p\.?m?\.?)?$/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  if (minute > 59) return null;
  const half = m[3]?.[0]?.toLowerCase();
  if (half) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (half === "p" ? 12 : 0);
  } else if (hour > 23 || (!m[2] && !half)) return null;
  return hour * 60 + minute;
}

/**
 * A workout's start and end, in minutes past midnight, from its time text ("5:15am-6:00am",
 * "5:15 - 6:00 AM", "5:30am"). An end without am/pm takes the start's.
 */
export function workoutTimes(time: string | null | undefined): {
  start: number | null;
  end: number | null;
} {
  if (!time?.trim()) return { start: null, end: null };
  const [first = "", second = ""] = time.split(/\s*(?:-|–|—|\bto\b)\s*/i);
  const half = (t: string) => t.match(/[ap]\.?m?\.?\s*$/i)?.[0] ?? "";
  // "5:15 - 6:00 PM": a time without am/pm borrows the other's.
  const read = (t: string, other: string) =>
    !t
      ? null
      : !half(t) && half(other)
        ? (parseClock(t + half(other)) ?? parseClock(t))
        : parseClock(t);
  return { start: read(first, second), end: read(second, first) };
}

/** The offset of a time zone from UTC at an instant, in milliseconds (positive east of UTC). */
function zoneOffset(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** The instant a wall-clock time happens in a time zone: a date ("2026-11-20") and minutes. */
export function zonedTime(
  date: string,
  minutes: number,
  timeZone: string,
): number {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, 0, minutes);
  const first = guess - zoneOffset(guess, timeZone);
  // Around a clock change the offset can differ at the answer; measure it there.
  return guess - zoneOffset(first, timeZone);
}

/** The date ("YYYY-MM-DD") it is in a time zone at an instant. */
export function zonedDate(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** A date ("YYYY-MM-DD") moved by some days. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** A time of day as people read it: 345 → "5:45am". */
export function clockText(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")}${hour < 12 ? "am" : "pm"}`;
}

export interface ReminderWorkout {
  id: string;
  title: string | null;
  ao: string | null;
  date: string | null;
  time: string | null;
}

export interface ReminderDraft {
  id: string;
  kind: "workout" | "backblast";
  title: string | null;
  created_at: string;
}

/** One notification to send, once: `kind` and `ref` together name it, so it's never repeated. */
export interface Notice {
  kind: string;
  ref: string;
  title: string;
  body: string;
  /** Where tapping it goes, relative to the site's root. */
  url: string;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long after its time a reminder can still go out (the check runs every few minutes; if it
 * misses a run, it catches up within this window, and after it the reminder is skipped).
 */
export const WINDOWS = {
  dayBefore: 2 * HOUR,
  morningOf: HOUR,
  backblast: 3 * HOUR,
  draft: DAY,
};

const named = (title: string | null, fallback: string) =>
  title?.trim() || fallback;

/**
 * The reminders due now for one PAX: their finished workouts (the day before, before it starts,
 * and for its backblast afterwards) and their drafts. `hasBackblast` holds the workouts that
 * already have a finished backblast. Times are in the PAX's time zone.
 */
export function dueReminders({
  now,
  settings,
  timeZone,
  workouts,
  drafts,
  hasBackblast,
}: {
  now: number;
  settings: NotificationSettings;
  timeZone: string;
  workouts: ReminderWorkout[];
  drafts: ReminderDraft[];
  hasBackblast: Set<string>;
}): Notice[] {
  const due: Notice[] = [];
  const within = (at: number, window: number) => now >= at && now < at + window;

  for (const w of workouts) {
    if (!w.date) continue;
    const title = named(w.title, "Your workout");
    const where = w.ao?.trim() ? ` at ${w.ao.trim()}` : "";
    const { start, end } = workoutTimes(w.time);
    const at = start !== null ? `, ${clockText(start)}` : "";

    if (settings.dayBefore.on) {
      const [h, m] = settings.dayBefore.time.split(":").map(Number);
      const when = zonedTime(addDays(w.date, -1), h! * 60 + m!, timeZone);
      if (within(when, WINDOWS.dayBefore))
        due.push({
          kind: "day_before",
          ref: `${w.id}:${w.date}`,
          title: `Tomorrow: ${title}`,
          body: `You're Q${where}${at}.`,
          url: `workout/?id=${w.id}`,
        });
    }

    if (settings.morningOf.on && start !== null) {
      const when = zonedTime(
        w.date,
        start - settings.morningOf.minutes,
        timeZone,
      );
      if (within(when, WINDOWS.morningOf))
        due.push({
          kind: "morning_of",
          ref: `${w.id}:${w.date}:${w.time}`,
          title: `In ${settings.morningOf.minutes} minutes: ${title}`,
          body: `You're Q${where}${at}. Run workout has it ready.`,
          url: `workout/run/?id=${w.id}`,
        });
    }

    // A workout with only a start is taken to run 45 minutes.
    const finish = end ?? (start !== null ? start + 45 : null);
    if (settings.backblast.on && finish !== null && !hasBackblast.has(w.id)) {
      const when = zonedTime(
        w.date,
        finish + settings.backblast.minutes,
        timeZone,
      );
      if (within(when, WINDOWS.backblast))
        due.push({
          kind: "backblast",
          ref: w.id,
          title: `Time for the backblast: ${title}`,
          body: "Write it while it's fresh. Tap to start it from the workout.",
          url: `backblasts/new/?workout=${w.id}`,
        });
    }
  }

  for (const d of drafts) {
    const started = Date.parse(d.created_at);
    settings.drafts.forEach((nudge, i) => {
      if (!nudge.on) return;
      if (!within(started + nudge.days * DAY, WINDOWS.draft)) return;
      const what = d.kind === "workout" ? "workout" : "backblast";
      due.push({
        kind: "draft",
        ref: `${d.kind}:${d.id}:${i + 1}`,
        title: `Finish your ${what} draft`,
        body: `${named(d.title, `Untitled ${what}`)} was started ${nudge.days} day${nudge.days === 1 ? "" : "s"} ago.`,
        url: `${d.kind}s/edit/?id=${d.id}`,
      });
    });
  }
  return due;
}
