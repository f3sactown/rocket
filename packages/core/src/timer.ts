/** The kinds of timer a thang can have on the Run workout screen. */
export type TimerType =
  "countdown" | "stopwatch" | "amrap" | "intervals" | "emom";

/** A thang's timer and its settings. Times are in seconds. */
export type Timer =
  | { type: "countdown"; seconds: number }
  | { type: "stopwatch" }
  | { type: "amrap"; seconds: number }
  | { type: "intervals"; work: number; rest: number; rounds: number }
  | { type: "emom"; every: number; rounds: number };

export const TIMER_TYPES: {
  type: TimerType;
  label: string;
  description: string;
}[] = [
  {
    type: "countdown",
    label: "Countdown",
    description: "Counts down a set time",
  },
  {
    type: "stopwatch",
    label: "Stopwatch",
    description: "Counts up until stopped",
  },
  {
    type: "amrap",
    label: "AMRAP",
    description: "As many rounds as possible in a set time",
  },
  {
    type: "intervals",
    label: "Tabata",
    description:
      "Work and rest, repeated for a number of rounds (20 seconds on, 10 off, 8 rounds to start)",
  },
  {
    type: "emom",
    label: "EMOM",
    description: "Every minute on the minute, for a number of rounds",
  },
];

/** A new timer of a type, with common settings to start from. */
export function newTimer(type: TimerType): Timer {
  switch (type) {
    case "countdown":
      return { type, seconds: 300 };
    case "stopwatch":
      return { type };
    case "amrap":
      return { type, seconds: 600 };
    case "intervals":
      return { type, work: 20, rest: 10, rounds: 8 };
    case "emom":
      return { type, every: 60, rounds: 10 };
  }
}

/** A time as m:ss, e.g. "5:00" or "0:45". */
export function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A short description of a timer, e.g. "Intervals · 8 × 0:20 on / 0:10 off". */
export function timerLabel(timer: Timer): string {
  switch (timer.type) {
    case "countdown":
      return `Countdown · ${formatTimer(timer.seconds)}`;
    case "stopwatch":
      return "Stopwatch";
    case "amrap":
      return `AMRAP · ${formatTimer(timer.seconds)}`;
    case "intervals":
      return `Tabata · ${timer.rounds} × ${formatTimer(timer.work)} on / ${formatTimer(timer.rest)} off`;
    case "emom":
      return `EMOM · ${timer.rounds} × ${formatTimer(timer.every)}`;
  }
}

/** One stretch of a timed run, e.g. round 3's rest. */
export interface TimerPhase {
  label: string;
  seconds: number;
  /** Whether it's a rest, shown differently. */
  rest?: boolean;
}

/** The stretches a timer counts down through, in order (none for a stopwatch). */
export function timerPhases(timer: Timer): TimerPhase[] {
  switch (timer.type) {
    case "countdown":
      return [{ label: "", seconds: timer.seconds }];
    case "stopwatch":
      return [];
    case "amrap":
      return [{ label: "AMRAP", seconds: timer.seconds }];
    case "intervals":
      return Array.from({ length: timer.rounds }, (_, i) => [
        {
          label: `Round ${i + 1} of ${timer.rounds} · Work`,
          seconds: timer.work,
        },
        // No rest after the last round.
        ...(i < timer.rounds - 1 && timer.rest > 0
          ? [
              {
                label: `Round ${i + 1} of ${timer.rounds} · Rest`,
                seconds: timer.rest,
                rest: true,
              },
            ]
          : []),
      ]).flat();
    case "emom":
      return Array.from({ length: timer.rounds }, (_, i) => ({
        label: `Round ${i + 1} of ${timer.rounds}`,
        seconds: timer.every,
      }));
  }
}

/** A timer read from stored data, or undefined if it isn't a well-formed one. */
export function parseTimer(value: unknown): Timer | undefined {
  if (!value || typeof value !== "object") return undefined;
  const t = value as Record<string, unknown>;
  const positive = (n: unknown) => typeof n === "number" && n > 0;
  switch (t.type) {
    case "countdown":
    case "amrap":
      return positive(t.seconds)
        ? { type: t.type, seconds: t.seconds as number }
        : undefined;
    case "stopwatch":
      return { type: "stopwatch" };
    // Saved while Tabata was a timer of its own: 20 seconds on and 10 off.
    case "tabata":
      return positive(t.rounds)
        ? { type: "intervals", work: 20, rest: 10, rounds: t.rounds as number }
        : undefined;
    case "intervals":
      return positive(t.work) && positive(t.rounds)
        ? {
            type: "intervals",
            work: t.work as number,
            rest: typeof t.rest === "number" && t.rest > 0 ? t.rest : 0,
            rounds: t.rounds as number,
          }
        : undefined;
    case "emom":
      return positive(t.every) && positive(t.rounds)
        ? { type: "emom", every: t.every as number, rounds: t.rounds as number }
        : undefined;
  }
  return undefined;
}

/** How a beep sounds: a short one counting down, or the long, louder one as a stretch ends. */
export type BeepKind = "tick" | "end";

/**
 * The beep for a moment in a stretch, like a Tabata timer's: short beeps with 3, 2 and 1 seconds
 * left, then a long, louder one at 0 as it ends (4 in all), in every stretch, work or rest. None at
 * other times.
 */
export function beepAt(secondsLeft: number): BeepKind | null {
  if (secondsLeft === 0) return "end";
  if (secondsLeft >= 1 && secondsLeft <= 3) return "tick";
  return null;
}
