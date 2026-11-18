import type { Thang } from "./backblast";
import type { Timer } from "./timer";

/** What the generator needs of an Exicon entry. */
export interface GeneratorEntry {
  name: string;
  description: string;
  tags: string[];
  isRoutine: boolean;
}

/** One exercise or routine in a generated workout, with its Exicon description. */
export interface GeneratedItem {
  name: string;
  /** How many (none for a routine, or Tabata, which goes by time). */
  reps?: number;
  description: string;
}

/** The Warm-o-rama, or one thang: what's in it, how it's done, and its timer. */
export interface GeneratedSection {
  /** How it's done, e.g. "AMRAP 12 minutes:" (none for the warm-up or a routine). */
  heading?: string;
  items: GeneratedItem[];
  timer?: Timer;
  /** A routine from the Exicon rather than a set of exercises. */
  routine?: boolean;
}

/** A workout put together from the Exicon: its Warm-o-rama and its thangs. */
export interface GeneratedWorkout {
  warmup: GeneratedSection;
  thangs: GeneratedSection[];
}

/** An Exicon description on one line, its spacing tidied. */
const tidy = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * A generated section as text, as it goes into the workout: each exercise and its count on a line,
 * with its description on the next when asked for (a blank line between them then, to read
 * easily); a thang starts with how it's done.
 */
export function sectionText(
  section: GeneratedSection,
  withDescriptions: boolean,
): string {
  const items = section.items.map((item) => {
    const name = item.reps
      ? `${item.name.trim()} x ${item.reps}`
      : item.name.trim();
    const description = tidy(item.description);
    return withDescriptions && description ? `${name}\n${description}` : name;
  });
  const body = items.join(withDescriptions ? "\n\n" : "\n");
  return [section.heading, body].filter(Boolean).join("\n");
}

/** A generated thang as a workout's thang: its text and its timer. */
export function generatedThang(
  section: GeneratedSection,
  withDescriptions: boolean,
): Thang {
  return {
    text: sectionText(section, withDescriptions),
    ...(section.timer && { timer: section.timer }),
  };
}

/** How many exercises the warm-up has, and how many thangs follow. */
const WARMUP_COUNT = 5;
const THANG_COUNT = 3;

const isWarmUp = (entry: GeneratorEntry) =>
  entry.tags.some((tag) => /^warm[\s-]?up$/i.test(tag.trim()));

/** Picks one of a list at random. */
function pickOne<T>(list: readonly T[], random: () => number): T {
  return list[Math.floor(random() * list.length)]!;
}

/** Shuffles a copy of a list. */
function shuffled<T>(list: readonly T[], random: () => number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Takes up to `count` entries at random, each more likely the more of the chosen tags it has,
 * never the same one twice.
 */
function weightedTake(
  pool: GeneratorEntry[],
  count: number,
  weight: (entry: GeneratorEntry) => number,
  random: () => number,
): GeneratorEntry[] {
  const left = [...pool];
  const taken: GeneratorEntry[] = [];
  while (taken.length < count && left.length) {
    const total = left.reduce((sum, entry) => sum + weight(entry), 0);
    let at = random() * total;
    let index = 0;
    for (; index < left.length - 1; index++) {
      at -= weight(left[index]!);
      if (at < 0) break;
    }
    taken.push(...left.splice(index, 1));
  }
  return taken;
}

/** An exercise with a count, and its description. */
const item = (entry: GeneratorEntry, reps?: number): GeneratedItem => ({
  name: entry.name.trim(),
  ...(reps && { reps }),
  description: entry.description,
});

/** The ways a thang of exercises can go, each with its timer for Run workout. */
const FORMATS: ((
  exercises: GeneratorEntry[],
  random: () => number,
) => GeneratedSection)[] = [
  // As many rounds as possible.
  (exercises, random) => {
    const minutes = pickOne([8, 10, 12], random);
    return {
      heading: `AMRAP ${minutes} minutes:`,
      items: exercises.map((e) => item(e, pickOne([10, 15, 20], random))),
      timer: { type: "amrap", seconds: minutes * 60 },
    };
  },
  // Every minute on the minute, a round each minute.
  (exercises, random) => {
    const rounds = pickOne([8, 10, 12], random);
    return {
      heading: `EMOM ${rounds} minutes, each minute:`,
      items: exercises.map((e) => item(e, pickOne([5, 8, 10], random))),
      timer: { type: "emom", every: 60, rounds },
    };
  },
  // Tabata: 20 seconds on, 10 off, 8 rounds of each exercise.
  (exercises) => ({
    heading: "Tabata, 20 seconds on and 10 off, 8 rounds of each:",
    items: exercises.map((e) => item(e)),
    timer: {
      type: "intervals",
      work: 20,
      rest: 10,
      rounds: 8 * exercises.length,
    },
  }),
  // Rounds for time.
  (exercises, random) => {
    const rounds = pickOne([3, 4, 5], random);
    return {
      heading: `${rounds} rounds for time:`,
      items: exercises.map((e) => item(e, pickOne([10, 15, 20, 25], random))),
      timer: { type: "stopwatch" },
    };
  },
];

/**
 * Puts a workout together at random from the Exicon entries given (already narrowed to the
 * sources and kind chosen), favoring those with more of the chosen tags: a Warm-o-rama of warm-up
 * exercises (those tagged Warm-Up first), then a few thangs, each a routine or a set of exercises
 * done one of several ways (AMRAP, EMOM, Tabata, rounds for time) with its timer. Each run gives a
 * different one.
 */
export function generateWorkout(
  entries: GeneratorEntry[],
  tags: string[],
  random: () => number = Math.random,
): GeneratedWorkout {
  const chosen = tags.map((t) => t.toLowerCase());
  const score = (entry: GeneratorEntry) =>
    entry.tags.filter((t) => chosen.includes(t.toLowerCase())).length;
  const named = entries.filter((e) => e.name.trim());
  const pool = named.filter((e) => score(e) > 0);
  const exercises = pool.filter((e) => !e.isRoutine);
  const routines = pool.filter((e) => e.isRoutine);
  const weight = (entry: GeneratorEntry) => score(entry) * 2 + 1;

  // Warm-o-rama: warm-up exercises with the chosen tags, then any warm-up exercises, then the
  // chosen tags' exercises.
  const warmups: GeneratorEntry[] = [];
  for (const candidates of [
    exercises.filter(isWarmUp),
    named.filter((e) => !e.isRoutine && isWarmUp(e)),
    exercises,
  ]) {
    const left = candidates.filter((e) => !warmups.includes(e));
    warmups.push(
      ...weightedTake(left, WARMUP_COUNT - warmups.length, weight, random),
    );
    if (warmups.length >= WARMUP_COUNT) break;
  }
  const warmup: GeneratedSection = {
    items: warmups.map((e) => item(e, pickOne([10, 15, 20], random))),
  };

  // The thangs, from what the warm-up didn't use.
  let leftExercises = exercises.filter((e) => !warmups.includes(e));
  let leftRoutines = [...routines];
  const thangs: GeneratedSection[] = [];
  const formats = shuffled(FORMATS, random);
  for (let i = 0; i < THANG_COUNT; i++) {
    const useRoutine =
      leftRoutines.length > 0 && (leftExercises.length < 3 || random() < 0.35);
    if (useRoutine) {
      const [routine] = weightedTake(leftRoutines, 1, weight, random);
      leftRoutines = leftRoutines.filter((e) => e !== routine);
      thangs.push({ items: [item(routine!)], routine: true });
      continue;
    }
    if (leftExercises.length === 0) break;
    const set = weightedTake(
      leftExercises,
      Math.min(leftExercises.length, 3 + Math.floor(random() * 2)),
      weight,
      random,
    );
    leftExercises = leftExercises.filter((e) => !set.includes(e));
    thangs.push(formats[i % formats.length]!(set, random));
  }
  return { warmup, thangs };
}
