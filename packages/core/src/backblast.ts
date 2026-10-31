/** How someone attended a beatdown, which changes how their name is shown in the Name-o-rama. */
export type AttendeeKind = "pax" | "visitor" | "fng" | "2.0";

export interface Attendee {
  name: string;
  kind: AttendeeKind;
  /** Home region, for visitors. */
  region?: string;
  /** The PAX who invited them, for FNGs. */
  invitedBy?: string;
}

/** A post-workout summary written by the Q for an F3 beatdown. */
export interface Backblast {
  title: string;
  /** Workout date in YYYY-MM-DD form. */
  date: string;
  ao: string;
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

/** The Name-o-rama line: everyone who posted, with the Q first and marked "(Q)". */
export function nameORama(backblast: Backblast): string {
  const q = backblast.q.trim().toLowerCase();
  return attendance(backblast)
    .map((attendee) =>
      q && attendee.name.trim().toLowerCase() === q
        ? `${attendeeLabel(attendee)} (Q)`
        : attendeeLabel(attendee),
    )
    .join(", ");
}

/** Render a backblast as plain text, ready to paste into Slack. Empty sections are left out. */
export function formatBackblast(backblast: Backblast): string {
  const header = [
    ["Backblast", backblast.title.trim()],
    ["Date", formatDate(backblast.date)],
    ["AO", backblast.ao.trim()],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");

  const count = paxCount(backblast);
  const sections: [string, string | undefined][] = [
    ["Introduction", backblast.introduction],
    ["Warm-o-rama", backblast.warmup],
    ["The Thang", backblast.thang],
    ["Count-o-rama", count ? String(count) : undefined],
    ["Name-o-rama", nameORama(backblast)],
    ["Announcements", backblast.announcements],
    ["Words of Wisdom", backblast.wordsOfWisdom],
    ["Third F", backblast.thirdF],
    ["Second F", backblast.secondF],
  ];

  return [
    header,
    ...sections
      .filter(([, body]) => body?.trim())
      .map(([heading, body]) => `${heading}:\n${body!.trim()}`),
  ]
    .filter(Boolean)
    .join("\n\n");
}
