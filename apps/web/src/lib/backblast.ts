import type { Attendee, AttendeeKind, Backblast } from "@rocket/core";
import type { Database, Json } from "./supabase/database.types";

type BackblastRow = Database["public"]["Tables"]["backblasts"]["Row"];

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
    attendees: parseAttendees(row.attendees),
    announcements: row.announcements ?? undefined,
    wordsOfWisdom: row.words_of_wisdom ?? undefined,
    thirdF: row.third_f ?? undefined,
    secondF: row.second_f ?? undefined,
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
    attendees: parseAttendees(backblast.attendees) as unknown as Json,
    announcements: text(backblast.announcements),
    words_of_wisdom: text(backblast.wordsOfWisdom),
    third_f: text(backblast.thirdF),
    second_f: text(backblast.secondF),
  };
}
