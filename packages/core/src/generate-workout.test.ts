import { describe, expect, it } from "vitest";
import {
  generatedThang,
  generateWorkout,
  sectionText,
  type GeneratorEntry,
} from "./generate-workout";

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

const exercise = (name: string, ...tags: string[]): GeneratorEntry => ({
  name,
  description: `${name} how-to`,
  tags,
  isRoutine: false,
});
const routine = (name: string, ...tags: string[]): GeneratorEntry => ({
  name,
  description: `${name} steps`,
  tags,
  isRoutine: true,
});

const LIBRARY: GeneratorEntry[] = [
  exercise("SSH", "Warm-Up", "Cardio"),
  exercise("Imperial Walker", "Warm-Up", "Core"),
  exercise("Arm Circles", "Warm-up", "Arms"),
  exercise("Mountain Climber", "Warm-Up", "Core", "Cardio"),
  exercise("Windmill", "Warm-Up"),
  exercise("Merkin", "Arms", "Chest"),
  exercise("Diamond Merkin", "Arms"),
  exercise("LBC", "Core"),
  exercise("Flutter Kick", "Core"),
  exercise("American Hammer", "Core"),
  exercise("Burpee", "Cardio", "Full Body"),
  exercise("Bear Crawl", "Cardio"),
  exercise("Squat", "Legs"),
  exercise("Lunge", "Legs"),
  routine("Dora 1-2-3", "Core", "Cardio"),
  routine("Mary", "Core"),
];

const names = (workout: ReturnType<typeof generateWorkout>) =>
  [workout.warmup, ...workout.thangs].flatMap((s) =>
    s.items.map((i) => i.name),
  );

describe("generateWorkout", () => {
  it("gives a warm-up of five warm-up exercises and three thangs", () => {
    const workout = generateWorkout(LIBRARY, ["Core", "Cardio"], seeded(1));
    expect(workout.warmup.items).toHaveLength(5);
    for (const item of workout.warmup.items)
      expect(item.reps).toBeGreaterThan(0);
    expect(workout.thangs).toHaveLength(3);
    for (const thang of workout.thangs)
      expect(thang.items.length).toBeGreaterThan(0);
  });

  it("uses only entries with a chosen tag in the thangs", () => {
    const workout = generateWorkout(LIBRARY, ["Legs", "Arms"], seeded(7));
    const used = workout.thangs.flatMap((t) => t.items.map((i) => i.name));
    for (const name of ["LBC", "Flutter Kick", "Burpee", "Mary"])
      expect(used).not.toContain(name);
  });

  it("doesn't repeat an exercise", () => {
    const used = names(generateWorkout(LIBRARY, ["Core", "Cardio"], seeded(3)));
    expect(new Set(used).size).toBe(used.length);
  });

  it("keeps each exercise's description", () => {
    const workout = generateWorkout(LIBRARY, ["Core", "Cardio"], seeded(1));
    for (const item of [workout.warmup, ...workout.thangs].flatMap(
      (s) => s.items,
    ))
      expect(item.description).toMatch(/how-to|steps/);
  });

  it("gives each thang of exercises a timer", () => {
    const workout = generateWorkout(
      LIBRARY.filter((e) => !e.isRoutine),
      ["Core", "Cardio", "Arms"],
      seeded(11),
    );
    for (const thang of workout.thangs) {
      expect(thang.timer).toBeDefined();
      expect(thang.heading).toBeTruthy();
    }
  });

  it("is different each time", () => {
    const a = generateWorkout(LIBRARY, ["Core", "Cardio"], seeded(1));
    const b = generateWorkout(LIBRARY, ["Core", "Cardio"], seeded(2));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("copes with too few matches", () => {
    const workout = generateWorkout(LIBRARY, ["Legs"], seeded(5));
    expect(workout.warmup.items.length).toBeGreaterThan(0);
    expect(workout.thangs.length).toBeLessThanOrEqual(3);
    expect(generateWorkout([], ["Legs"], seeded(5))).toEqual({
      warmup: { items: [] },
      thangs: [],
    });
  });
});

describe("sectionText", () => {
  const section = {
    heading: "AMRAP 10 minutes:",
    items: [
      {
        name: "Merkin",
        reps: 10,
        description: "A push-up.\n  Count in cadence.",
      },
      { name: "Bear Crawl", description: "" },
    ],
    timer: { type: "amrap" as const, seconds: 600 },
  };

  it("lists each exercise and its count", () => {
    expect(sectionText(section, false)).toBe(
      "AMRAP 10 minutes:\nMerkin x 10\nBear Crawl",
    );
  });

  it("adds descriptions on their own lines, tidied, with space between", () => {
    expect(sectionText(section, true)).toBe(
      "AMRAP 10 minutes:\nMerkin x 10\nA push-up. Count in cadence.\n\nBear Crawl",
    );
  });

  it("makes a thang with its timer", () => {
    expect(generatedThang(section, false)).toEqual({
      text: "AMRAP 10 minutes:\nMerkin x 10\nBear Crawl",
      timer: { type: "amrap", seconds: 600 },
    });
  });
});
