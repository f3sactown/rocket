import { termsFor, type Language } from "./terms";

/** How someone attended a beatdown, which changes how their name is shown in the Name-o-rama. */
export type AttendeeKind = "pax" | "visitor" | "fng" | "2.0";

export interface Attendee {
  name: string;
  kind: AttendeeKind;
  /** Home region, for downrange PAX (visiting from another region). */
  region?: string;
  /** The PAX who invited them, for FNGs. */
  invitedBy?: string;
}

/** A post-workout summary written by the Q for an F3 or FiA beatdown. */
export interface Backblast {
  title: string;
  /** Workout date in YYYY-MM-DD form. */
  date: string;
  ao: string;
  /** Where the AO meets, e.g. "Oki Park - 2715 Wissemann Dr, Sacramento, CA 95826". */
  address?: string;
  q: string;
  introduction?: string;
  warmup?: string;
  thang?: string;
  /** Everyone who posted besides the Q. */
  attendees: Attendee[];
  announcements?: string;
  wordsOfWisdom?: string;
  thirdF?: string;
  secondF?: string;
}

/** Starting text for the Introduction section; the Q can edit it. */
export const DEFAULT_INTRODUCTION = `Mission: To plant, grow and serve small workout groups for men for the invigoration of male community leadership.

Core principles:
1. Free of charge
2. Open to all men
3. Held outdoors, rain or shine, heat or cold
4. Led by men in a rotating fashion, with no professionals
5. Ends with a Circle of Trust

Disclaimer: I am not a professional. You are here of your own free will and participate at your own risk. Modify as needed.

Credo: Leave no man behind, but leave no man where you found him.`;

/** A name as it appears in the Name-o-rama, e.g. "Huggies (South Fork)" or "Rookie (FNG, invited by Sparky)". */
export function attendeeLabel(attendee: Attendee): string {
  const name = attendee.name.trim();
  switch (attendee.kind) {
    case "visitor":
      return attendee.region?.trim()
        ? `${name} (${attendee.region.trim()})`
        : name;
    case "fng":
      return attendee.invitedBy?.trim()
        ? `${name} (FNG, invited by ${attendee.invitedBy.trim()})`
        : `${name} (FNG)`;
    case "2.0":
      return `${name} (2.0)`;
    default:
      return name;
  }
}

/** Everyone who posted, Q first, with blank names and duplicates removed. */
export function attendance(backblast: Backblast): Attendee[] {
  const seen = new Set<string>();
  const all: Attendee[] = [
    { name: backblast.q, kind: "pax" },
    ...backblast.attendees,
  ];
  return all.filter((attendee) => {
    const key = attendee.name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Total attendance for the Count-o-rama, including the Q, FNGs and 2.0s. */
export function paxCount(backblast: Backblast): number {
  return attendance(backblast).length;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  return `${day}${["th", "st", "nd", "rd"][day % 10] ?? "th"}`;
}

/** A YYYY-MM-DD date written out, e.g. "October 31st, 2026". Other input is returned as is. */
export function formatDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  const day = match ? Number(match[3]) : 0;
  if (!match || !month || day < 1 || day > 31) return date;
  return `${month} ${ordinal(day)}, ${match[1]}`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A YYYY-MM-DD date in short form, e.g. "Wed, Oct 14, 2026". Other input is returned as is. */
export function formatShortDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return date;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day)
    return date;
  return `${DAYS[parsed.getUTCDay()]}, ${MONTHS[month - 1].slice(0, 3)} ${day}, ${year}`;
}

/** A name as a Slack mention, e.g. "@Casper". */
export function mention(name: string): string {
  const trimmed = name.trim();
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

/**
 * An attendee in the Event Data lists, e.g. "@Dingo (South Fork)", "@Ellie (invited by @Casper)"
 * or "@Little Casper (2.0)".
 */
function attendeeMention(attendee: Attendee): string {
  const name = mention(attendee.name);
  if (attendee.kind === "visitor" && attendee.region?.trim())
    return `${name} (${attendee.region.trim()})`;
  if (attendee.kind === "fng" && attendee.invitedBy?.trim())
    return `${name} (invited by ${mention(attendee.invitedBy)})`;
  if (attendee.kind === "2.0") return `${name} (2.0)`;
  return name;
}

/** Joins the non-empty blocks of a part with blank lines. */
function blocks(...parts: (string | false | undefined)[]): string {
  return parts.filter((part) => part && part.trim()).join("\n\n");
}

/** Event Data: AO and date, address, attendance, the Q, and the PAX grouped by kind. */
function eventData(backblast: Backblast): string {
  const q = backblast.q.trim();
  const others = attendance(backblast).filter(
    (attendee) => !q || attendee.name.trim().toLowerCase() !== q.toLowerCase(),
  );
  const group = (title: string, kind: AttendeeKind) => {
    const people = others.filter((attendee) => attendee.kind === kind);
    return (
      people.length > 0 &&
      `${title} (${people.length}):\n${people.map(attendeeMention).join("\n")}`
    );
  };
  const where = [
    [backblast.ao.trim(), formatShortDate(backblast.date)]
      .filter(Boolean)
      .join(" - "),
    backblast.address?.trim(),
  ]
    .filter(Boolean)
    .join("\n");
  const total = paxCount(backblast);

  return blocks(
    where,
    total > 0 && `Total Attendees: ${total}`,
    q && `Q: ${mention(q)}`,
    group("PAX", "pax"),
    group("Downrange PAX", "visitor"),
    group("FNGs", "fng"),
    group("2.0s", "2.0"),
  );
}

/** A labeled block, or nothing when the text is blank. */
function labeled(label: string, text: string | undefined): string | false {
  return Boolean(text?.trim()) && `${label}:\n${text!.trim()}`;
}

export interface BackblastPart {
  title: "Event Data" | "Workout Details" | "COT / Closing";
  text: string;
}

/**
 * The backblast's text in its three parts, leaving out blank sections and parts with nothing in
 * them. The review screen shows each part on its own; the copied text joins them.
 */
export function backblastParts(
  backblast: Backblast,
  language: Language = "f3",
): BackblastPart[] {
  const terms = termsFor(language);
  const parts: BackblastPart[] = [
    { title: "Event Data", text: eventData(backblast) },
    {
      title: "Workout Details",
      text: blocks(
        backblast.title.trim() && `Title: ${backblast.title.trim()}`,
        labeled("Introduction", backblast.introduction),
        labeled(terms.warmup, backblast.warmup),
        labeled(terms.thang, backblast.thang),
      ),
    },
    {
      title: "COT / Closing",
      text: blocks(
        labeled("Announcements", backblast.announcements),
        labeled("Words of Wisdom", backblast.wordsOfWisdom),
        labeled(terms.thirdF, backblast.thirdF),
        labeled(terms.secondF, backblast.secondF),
      ),
    },
  ];
  return parts.filter((part) => part.text);
}

/** Render a backblast as plain text, ready to paste into Slack, in the given vocabulary. */
export function formatBackblast(
  backblast: Backblast,
  language: Language = "f3",
): string {
  return backblastParts(backblast, language)
    .map((part) => part.text)
    .join("\n\n");
}
