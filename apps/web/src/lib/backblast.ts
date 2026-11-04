import {
  parseTimer,
  thangText,
  type Attendee,
  type AttendeeKind,
  type Backblast,
  type Thang,
  type Workout,
} from "@rocket/core";
import { createClient } from "./supabase/client";
import type { Database, Json } from "./supabase/database.types";

type BackblastRow = Database["public"]["Tables"]["backblasts"]["Row"];
type WorkoutRow = Database["public"]["Tables"]["workouts"]["Row"];

const KINDS: AttendeeKind[] = ["pax", "visitor", "fng", "2.0"];

/** Keep only well-formed attendees from untrusted JSON (form input or the database). */
export function parseAttendees(value: Json | unknown): Attendee[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): Attendee[] => {
    if (!item || typeof item !== "object") return [];
    const { name, kind, region, invitedBy } = item as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim()) return [];
    if (!KINDS.includes(kind as AttendeeKind)) return [];
    const attendee: Attendee = {
      name: name.trim(),
      kind: kind as AttendeeKind,
    };
    if (kind === "visitor" && typeof region === "string" && region.trim())
      attendee.region = region.trim();
    if (kind === "fng" && typeof invitedBy === "string" && invitedBy.trim())
      attendee.invitedBy = invitedBy.trim();
    return [attendee];
  });
}

export function fromRow(row: BackblastRow): Backblast {
  return {
    title: row.title,
    date: row.date ?? "",
    ao: row.ao,
    address: row.address ?? undefined,
    time: row.time ?? undefined,
    q: row.q,
    introduction: row.introduction ?? undefined,
    warmup: row.warmup ?? undefined,
    thang: row.thang ?? undefined,
    notes: row.notes ?? undefined,
    attendees: parseAttendees(row.attendees),
    announcements: row.announcements ?? undefined,
    wordsOfWisdom: row.words_of_wisdom ?? undefined,
    thirdF: row.third_f ?? undefined,
    secondF: row.second_f ?? undefined,
    workoutId: row.workout_id ?? undefined,
  };
}

export function toInsert(
  backblast: Backblast,
): Database["public"]["Tables"]["backblasts"]["Insert"] {
  const text = (value: string | undefined) => value?.trim() || null;
  return {
    title: backblast.title.trim(),
    date: backblast.date || null,
    ao: backblast.ao.trim(),
    address: text(backblast.address),
    time: text(backblast.time),
    q: backblast.q.trim(),
    introduction: text(backblast.introduction),
    warmup: text(backblast.warmup),
    thang: text(backblast.thang),
    notes: text(backblast.notes),
    attendees: parseAttendees(backblast.attendees) as unknown as Json,
    announcements: text(backblast.announcements),
    words_of_wisdom: text(backblast.wordsOfWisdom),
    third_f: text(backblast.thirdF),
    second_f: text(backblast.secondF),
    workout_id: backblast.workoutId ?? null,
  };
}

/** A workout from its row; its notes are kept apart (see loadWorkoutNotes). */
export function fromWorkoutRow(row: WorkoutRow, notes?: string): Workout {
  return {
    title: row.title,
    date: row.date ?? "",
    ao: row.ao,
    address: row.address ?? undefined,
    time: row.time ?? undefined,
    q: "",
    attendees: [],
    introduction: row.introduction ?? undefined,
    warmup: row.warmup ?? undefined,
    // Written out from the thangs each time, so it's current (music included) even for
    // workouts saved before the text changed.
    thang: (() => {
      const thangs = parseThangs(row.thangs, row.thang);
      return thangs.length ? thangText(thangs) : (row.thang ?? undefined);
    })(),
    thangs: parseThangs(row.thangs, row.thang),
    moreDates: row.more_dates ?? [],
    notes: notes || undefined,
    announcements: row.announcements ?? undefined,
    wordsOfWisdom: row.words_of_wisdom ?? undefined,
  };
}

export function toWorkoutInsert(
  workout: Workout,
): Database["public"]["Tables"]["workouts"]["Insert"] {
  const text = (value: string | undefined) => value?.trim() || null;
  return {
    title: workout.title.trim(),
    date: workout.date || null,
    ao: workout.ao.trim(),
    address: text(workout.address),
    time: text(workout.time),
    introduction: text(workout.introduction),
    warmup: text(workout.warmup),
    // The written-out text goes in `thang`, for backblasts and the output.
    thang: workout.thangs
      ? text(thangText(workout.thangs))
      : text(workout.thang),
    thangs: (workout.thangs ?? [])
      .filter((t) => t.text.trim() || t.timer || t.music)
      .map((t) =>
        // Music is kept only once it's a full link.
        t.music && !/^https?:\/\/\S+$/i.test(t.music.url.trim())
          ? { ...t, music: undefined }
          : t,
      ) as unknown as Json,
    announcements: text(workout.announcements),
    words_of_wisdom: text(workout.wordsOfWisdom),
  };
}

/** A workout's sections, for copying into a backblast; an error message if it can't be read. */
export async function loadWorkout(id: string): Promise<Workout | string> {
  const { data, error } = await createClient()
    .from("workouts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return error.message;
  if (!data) return "That workout is gone or isn't shared.";
  return fromWorkoutRow(data);
}

/**
 * A workout's notes, which only its Q can read: empty for anyone else, or when there are none.
 */
export async function loadWorkoutNotes(workoutId: string): Promise<string> {
  const { data } = await createClient()
    .from("workout_notes")
    .select("body")
    .eq("workout_id", workoutId)
    .maybeSingle();
  return data?.body ?? "";
}

/** Saves a workout's private notes. */
export async function saveWorkoutNotes(workoutId: string, body: string) {
  const { error } = await createClient()
    .from("workout_notes")
    .upsert(
      { workout_id: workoutId, body: body.trim() },
      { onConflict: "workout_id" },
    );
  if (error) throw error;
}

/** A workout's thangs from the database, or its older single thang text as one thang. */
export function parseThangs(
  value: Json | unknown,
  thang?: string | null,
): Thang[] {
  const list = Array.isArray(value)
    ? value.flatMap((item): Thang[] => {
        if (!item || typeof item !== "object") return [];
        const { text, timer, seconds, music } = item as Record<string, unknown>;
        if (typeof text !== "string") return [];
        // Thangs saved before there were kinds of timer had just a countdown length.
        const parsed =
          parseTimer(timer) ??
          (typeof seconds === "number" && seconds > 0
            ? ({ type: "countdown", seconds } as const)
            : undefined);
        const link = parseMusic(music);
        return [
          {
            text,
            ...(parsed ? { timer: parsed } : {}),
            ...(link ? { music: link } : {}),
          },
        ];
      })
    : [];
  if (list.length) return list;
  return thang?.trim() ? [{ text: thang }] : [];
}

/** A thang's music link from stored data, if it's a web address. */
function parseMusic(value: unknown): Thang["music"] {
  if (!value || typeof value !== "object") return undefined;
  const { url, title } = value as Record<string, unknown>;
  if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim()))
    return undefined;
  return typeof title === "string" && title.trim()
    ? { url: url.trim(), title: title.trim() }
    : { url: url.trim() };
}

/** Adds a date to a workout so it can be run (and written up) again; its author only. */
export async function addWorkoutDate(
  workoutId: string,
  date: string,
): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workouts")
    .select("date, more_dates")
    .eq("id", workoutId)
    .single();
  if (error) throw error;
  const more = [...new Set([...(data.more_dates ?? []), date])]
    .filter((d) => d !== data.date)
    .sort();
  const { error: saveError } = await supabase
    .from("workouts")
    .update({ more_dates: more })
    .eq("id", workoutId);
  if (saveError) throw saveError;
  return more;
}
