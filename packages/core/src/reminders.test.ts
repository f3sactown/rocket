import { describe, expect, it } from "vitest";
// The push notification schedule lives with the Edge Function that sends them; it has no imports,
// so it's tested here.
import {
  DEFAULT_SETTINGS,
  dueReminders,
  normalizeSettings,
  parseClock,
  workoutTimes,
  zonedDate,
  zonedTime,
} from "../../../supabase/functions/_shared/reminders";

const LA = "America/Los_Angeles";
const at = (iso: string) => Date.parse(iso);

describe("clock times", () => {
  it("reads am/pm and 24-hour times", () => {
    expect(parseClock("5:15am")).toBe(315);
    expect(parseClock("5:15 AM")).toBe(315);
    expect(parseClock("5am")).toBe(300);
    expect(parseClock("12:30pm")).toBe(750);
    expect(parseClock("12:00am")).toBe(0);
    expect(parseClock("17:30")).toBe(1050);
    expect(parseClock("0515")).toBe(315);
    expect(parseClock("5")).toBeNull();
    expect(parseClock("dawn")).toBeNull();
  });

  it("finds a workout's start and end", () => {
    expect(workoutTimes("5:15am-6:00am")).toEqual({ start: 315, end: 360 });
    expect(workoutTimes("5:15 - 6:00 PM")).toEqual({ start: 1035, end: 1080 });
    expect(workoutTimes("5:30am")).toEqual({ start: 330, end: null });
    expect(workoutTimes("5:30am to 6:15am")).toEqual({ start: 330, end: 375 });
    expect(workoutTimes("")).toEqual({ start: null, end: null });
  });
});

describe("time zones", () => {
  it("turns a local wall time into the instant, across daylight saving", () => {
    // Pacific Standard Time (UTC-8) in November, Daylight Time (UTC-7) in July.
    expect(zonedTime("2026-11-20", 6 * 60, LA)).toBe(
      at("2026-11-20T14:00:00Z"),
    );
    expect(zonedTime("2026-07-20", 6 * 60, LA)).toBe(
      at("2026-07-20T13:00:00Z"),
    );
    expect(zonedDate(at("2026-11-20T07:59:00Z"), LA)).toBe("2026-11-19");
  });
});

describe("settings", () => {
  it("fills in defaults and keeps values in range", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    const s = normalizeSettings({
      dayBefore: { on: false, time: "7:00" },
      morningOf: { minutes: 9999 },
      drafts: [{ days: 3 }, { on: true }],
    });
    expect(s.dayBefore).toEqual({ on: false, time: "06:00" });
    expect(s.morningOf).toEqual({ on: true, minutes: 240 });
    expect(s.drafts).toEqual([
      { on: true, days: 3 },
      { on: true, days: 4 },
      { on: false, days: 6 },
    ]);
  });
});

describe("due reminders", () => {
  const workout = {
    id: "w1",
    title: "Hills",
    ao: "The Rock",
    date: "2026-11-20",
    time: "5:15am-6:00am",
  };
  const run = (
    now: string,
    extra: Partial<Parameters<typeof dueReminders>[0]> = {},
  ) =>
    dueReminders({
      now: at(now),
      settings: DEFAULT_SETTINGS,
      timeZone: LA,
      workouts: [workout],
      drafts: [],
      hasBackblast: new Set(),
      ...extra,
    }).map((n) => `${n.kind}:${n.ref}`);

  it("reminds the day before at 6am", () => {
    // 6:00am Pacific on the 19th is 14:00 UTC.
    expect(run("2026-11-19T13:59:00Z")).toEqual([]);
    expect(run("2026-11-19T14:02:00Z")).toEqual(["day_before:w1:2026-11-20"]);
    expect(run("2026-11-19T16:30:00Z")).toEqual([]);
  });

  it("reminds 40 minutes before the start", () => {
    // 4:35am Pacific on the 20th.
    expect(run("2026-11-20T12:35:00Z")).toEqual([
      "morning_of:w1:2026-11-20:5:15am-6:00am",
    ]);
  });

  it("reminds about the backblast 30 minutes after the end, unless it's written", () => {
    // 6:30am Pacific.
    expect(run("2026-11-20T14:31:00Z")).toEqual(["backblast:w1"]);
    expect(
      run("2026-11-20T14:31:00Z", { hasBackblast: new Set(["w1"]) }),
    ).toEqual([]);
  });

  it("follows the settings", () => {
    const settings = normalizeSettings({
      dayBefore: { on: true, time: "19:30" },
      morningOf: { on: false },
    });
    // 7:30pm Pacific on the 19th is 03:30 UTC on the 20th.
    expect(run("2026-11-20T03:31:00Z", { settings })).toEqual([
      "day_before:w1:2026-11-20",
    ]);
    expect(run("2026-11-20T12:35:00Z", { settings })).toEqual([]);
  });

  it("nudges about drafts after 2 days, and after 4 and 6 when turned on", () => {
    const drafts = [
      {
        id: "d1",
        kind: "backblast" as const,
        title: "Coupons",
        created_at: "2026-11-10T15:00:00Z",
      },
    ];
    expect(run("2026-11-12T15:05:00Z", { workouts: [], drafts })).toEqual([
      "draft:backblast:d1:1",
    ]);
    expect(run("2026-11-14T15:05:00Z", { workouts: [], drafts })).toEqual([]);
    const settings = normalizeSettings({
      drafts: [{}, { on: true }, { on: true }],
    });
    expect(
      run("2026-11-14T15:05:00Z", { workouts: [], drafts, settings }),
    ).toEqual(["draft:backblast:d1:2"]);
    expect(
      run("2026-11-16T15:05:00Z", { workouts: [], drafts, settings }),
    ).toEqual(["draft:backblast:d1:3"]);
  });
});
