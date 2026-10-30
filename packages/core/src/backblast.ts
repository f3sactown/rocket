/** A post-workout summary written by the Q for an F3 beatdown. */
export interface Backblast {
  title: string;
  /** Workout date in YYYY-MM-DD form. */
  date: string;
  ao: string;
  q: string;
  pax: string[];
  fngs: string[];
  warmup?: string;
  thang?: string;
  moleskin?: string;
}

/** Total head count: every PAX plus the Q and any FNGs, de-duplicated. */
export function paxCount(backblast: Backblast): number {
  const names = [backblast.q, ...backblast.pax, ...backblast.fngs];
  return new Set(names.map((name) => name.trim().toLowerCase()).filter(Boolean))
    .size;
}

/** Render a backblast as plain text, ready to paste into Slack. */
export function formatBackblast(backblast: Backblast): string {
  const lines = [
    `*Backblast: ${backblast.title}*`,
    `DATE: ${backblast.date}`,
    `AO: ${backblast.ao}`,
    `Q: ${backblast.q}`,
    `PAX: ${backblast.pax.join(", ") || "None"}`,
    `FNGs: ${backblast.fngs.join(", ") || "None"}`,
    `COUNT: ${paxCount(backblast)}`,
  ];

  const sections: [string, string | undefined][] = [
    ["WARMUP", backblast.warmup],
    ["THE THANG", backblast.thang],
    ["MOLESKIN", backblast.moleskin],
  ];
  for (const [heading, body] of sections) {
    if (body?.trim()) lines.push("", `*${heading}:*`, body.trim());
  }

  return lines.join("\n");
}
