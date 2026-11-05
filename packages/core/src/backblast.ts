import { termsFor, type Language } from "./terms";
import type { Timer } from "./timer";

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
  /** Where the AO meets, e.g. "Oki Park". The output leaves out any street address after " - ". */
  address?: string;
  /** When the workout ran, e.g. "5:15am-6:00am". */
  time?: string;
  /** The Q, or several separated by commas, e.g. "Casper, Sparky". */
  q: string;
  introduction?: string;
  warmup?: string;
  thang?: string;
  /**
   * A workout's thangs, each with an optional timer for running it. When set, `thang` is these
   * written out (see thangText).
   */
  thangs?: Thang[];
  /** Anything else about the workout, after The Thang. */
  notes?: string;
  /** Everyone who posted besides the Q. */
  attendees: Attendee[];
  announcements?: string;
  wordsOfWisdom?: string;
  thirdF?: string;
  secondF?: string;
  /** The workout this backblast was made from, if any. */
  workoutId?: string;
  /** A workout's visibility once finished: public (the default) or private to its Q. */
  visibility?: "public" | "private";
  /** For a workout made with Reuse, the workout it was copied from. */
  reusedFrom?: string;
  /**
   * For a reused workout, the Q who wrote the first one in the chain: a reuse of a reuse still
   * credits the original author.
   */
  originalAuthorId?: string;
}

/**
 * The plan for a beatdown, written before it. It has the same fields as a backblast but no Q,
 * attendance or COT sections, and its notes are its own. A backblast is made from it.
 */
export type Workout = Backblast;

/** One part of The Thang, with an optional timer shown when running the workout. */
export interface Thang {
  text: string;
  timer?: Timer;
  /** A song or playlist to play during it, as a link (Spotify, YouTube, Apple Music…). */
  music?: { url: string; title?: string };
}

/** A thang's music as text, e.g. "🎵 Eye of the Tiger 🎵" with its link on the next line. */
function musicLine(music: Thang["music"]): string | undefined {
  const url = music?.url.trim();
  if (!url || !/^https?:\/\//i.test(url)) return undefined;
  const title = music?.title?.trim();
  // The link goes on its own line under a named song.
  return title ? `🎵 ${title} 🎵\n${url}` : `🎵 ${url}`;
}

/**
 * The thangs written out for The Thang, separated by blank lines, each followed by its music
 * (title and link) when it has some.
 * Timers aren't included; they're for running the workout.
 */
export function thangText(thangs: Thang[]): string {
  const parts = thangs
    .map((t) => [t.text.trim(), musicLine(t.music)].filter(Boolean).join("\n"))
    .filter(Boolean);
  return parts.join("\n\n");
}

/** The workout sections a backblast copies from its workout (everything but the notes). */
export const WORKOUT_SECTIONS = [
  "title",
  "date",
  "ao",
  "address",
  "time",
  "introduction",
  "warmup",
  "thang",
  "announcements",
  "wordsOfWisdom",
] as const satisfies readonly (keyof Backblast)[];

/** The backblast with the workout's sections copied in, replacing its own. */
export function copyWorkout(backblast: Backblast, workout: Workout): Backblast {
  const copied = { ...backblast };
  for (const key of WORKOUT_SECTIONS) copied[key] = workout[key] ?? "";
  return copied;
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

/**
 * Reads a name as a region's sheet may write it, with a note in parentheses: "McLovin (Seattle)"
 * is downrange from Seattle and "Cubby (2.0)" is a 2.0. Other names are regular PAX.
 */
export function attendeeFromName(name: string): Attendee {
  const match = /^(.+?)\s*\(([^()]+)\)\s*$/.exec(name);
  if (!match) return { name, kind: "pax" };
  const plain = match[1]!.trim();
  const note = match[2]!.trim();
  return note === "2.0"
    ? { name: plain, kind: "2.0" }
    : { name: plain, kind: "visitor", region: note };
}

/** Short words left lowercase inside a title, as most style guides do. */
const SMALL_WORDS = new Set(
  "a an and as at but by for from in into nor of off on onto or over per so the to up via vs with yet".split(
    " ",
  ),
);

/**
 * A title in title case: "hills for days" becomes "Hills for Days". Words keep any capitals
 * already in them (e.g. "McKinley", "WOD"); short words stay lowercase unless they start or end
 * the title or follow a colon.
 */
export function titleCase(title: string): string {
  const words = title.split(/(\s+)/);
  const last = words.length - 1;
  return words
    .map((word, index) => {
      if (/^\s*$/.test(word)) return word;
      const lower = word.toLowerCase();
      const afterColon = index >= 2 && /:$/.test(words[index - 2]!);
      if (
        index !== 0 &&
        index !== last &&
        !afterColon &&
        SMALL_WORDS.has(lower.replace(/[^a-z]/g, ""))
      )
        return lower;
      // Capitalize each part of a hyphenated word, after any leading punctuation.
      return word.replace(
        /(^|-)([^a-zA-Z0-9]*)([a-z])/g,
        (_, start, punctuation, letter) =>
          start + punctuation + letter.toUpperCase(),
      );
    })
    .join("");
}

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

/** The backblast's Qs, from its comma-separated Q field, without blanks or duplicates. */
export function qNames(backblast: Pick<Backblast, "q">): string[] {
  const seen = new Set<string>();
  return backblast.q
    .split(",")
    .map((name) => name.trim())
    .filter((name) => {
      const key = name.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** The Q field for a list of Qs. */
export function joinQs(names: string[]): string {
  return names.join(", ");
}

/** Whether a name is one of the backblast's Qs. */
export function isQ(backblast: Pick<Backblast, "q">, name: string): boolean {
  const key = name.trim().toLowerCase();
  return qNames(backblast).some((q) => q.toLowerCase() === key);
}

/** Everyone who posted, Qs first, with blank names and duplicates removed. */
export function attendance(backblast: Backblast): Attendee[] {
  const seen = new Set<string>();
  const all: Attendee[] = [
    ...qNames(backblast).map((name) => ({ name, kind: "pax" as const })),
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

/**
 * Where the AO meets, without a street address: "McKinley Park - 601 Alhambra Blvd" becomes
 * "McKinley Park". Older backblasts stored both.
 */
function location(address: string | undefined): string | undefined {
  return address?.split(" - ")[0]?.trim();
}

/** Event Data: AO, date and time, location, attendance, the Q, and the PAX grouped by kind. */
function eventData(backblast: Backblast): string {
  const qs = qNames(backblast);
  const others = attendance(backblast).filter(
    (attendee) => !isQ(backblast, attendee.name),
  );
  const group = (title: string, kind: AttendeeKind) => {
    const people = others.filter((attendee) => attendee.kind === kind);
    return (
      people.length > 0 &&
      `${title} (${people.length}):\n${people.map(attendeeMention).join("\n")}`
    );
  };
  const where = [
    [
      backblast.ao.trim(),
      formatShortDate(backblast.date),
      backblast.time?.trim(),
    ]
      .filter(Boolean)
      .join(" - "),
    location(backblast.address),
  ]
    .filter(Boolean)
    .join("\n");
  const total = paxCount(backblast);

  return blocks(
    where,
    total > 0 && `Total Attendees: ${total}`,
    qs.length > 0 &&
      `${qs.length > 1 ? "Qs" : "Q"}: ${qs.map(mention).join(", ")}`,
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
        backblast.title.trim() && `Title: ${titleCase(backblast.title.trim())}`,
        labeled("Introduction", backblast.introduction),
        labeled(terms.warmup, backblast.warmup),
        labeled(terms.thang, backblast.thang),
        labeled("Notes", backblast.notes),
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

/**
 * Everyone who posted on one line, e.g. "Casper, Huggies (South Fork), Rookie, Cubby (2.0)":
 * no @, downrange PAX with their region and 2.0s marked, FNGs by name alone.
 */
export function paxList(backblast: Backblast): string {
  return attendance(backblast)
    .map((attendee) => {
      const name = attendee.name.trim();
      if (attendee.kind === "visitor" && attendee.region?.trim())
        return `${name} (${attendee.region.trim()})`;
      if (attendee.kind === "2.0") return `${name} (2.0)`;
      return name;
    })
    .join(", ");
}

/**
 * The text that's copied or shared: the backblast, then a few blank lines and the PAX list. The
 * list isn't shown on screen.
 */
export function copyText(
  backblast: Backblast,
  language: Language = "f3",
): string {
  return [formatBackblast(backblast, language), paxList(backblast)]
    .filter(Boolean)
    .join("\n\n\n\n");
}
