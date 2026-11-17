import { describe, expect, it } from "vitest";
import { generateWorkout, type GeneratorEntry } from "./generate-workout";

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

const exercise = (name: string, ...tags: string[]): GeneratorEntry => ({
  name,
  description: `${name} description`,
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

describe("generateWorkout", () => {
  it("gives a warm-up of warm-up exercises and three thangs", () => {
    const workout = generateWorkout(LIBRARY, ["Core", "Cardio"], seeded(1));
    const lines = workout.warmup.split("\n");
    expect(lines).toHaveLength(5);
    for (const l of lines) expect(l).toMatch(/ x \d+$/);
    expect(workout.thangs).toHaveLength(3);
    for (const thang of workout.thangs) expect(thang.text.trim()).not.toBe("");
  });

  it("uses only entries with a chosen tag in the thangs", () => {
    const workout = generateWorkout(LIBRARY, ["Legs", "Arms"], seeded(7));
    const text = workout.thangs.map((t) => t.text).join("\n");
    for (const name of ["LBC", "Flutter Kick", "Burpee", "Mary"])
      expect(text).not.toContain(name);
  });

  it("doesn't repeat an exercise", () => {
    const workout = generateWorkout(LIBRARY, ["Core", "Cardio"], seeded(3));
    const names = [
      ...workout.warmup.split("\n"),
      ...workout.thangs.flatMap((t) => t.text.split("\n").slice(1)),
    ]
      .map((l) => l.replace(/ x \d+$/, ""))
      .filter((l) => LIBRARY.some((e) => e.name === l));
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives each thang of exercises a timer", () => {
    const workout = generateWorkout(
      LIBRARY.filter((e) => !e.isRoutine),
      ["Core", "Cardio", "Arms"],
      seeded(11),
    );
    for (const thang of workout.thangs) expect(thang.timer).toBeDefined();
  });

  it("is different each time", () => {
    const a = generateWorkout(LIBRARY, ["Core", "Cardio"], seeded(1));
    const b = generateWorkout(LIBRARY, ["Core", "Cardio"], seeded(2));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("copes with too few matches", () => {
    const workout = generateWorkout(LIBRARY, ["Legs"], seeded(5));
    expect(workout.warmup).not.toBe("");
    expect(workout.thangs.length).toBeLessThanOrEqual(3);
    expect(generateWorkout([], ["Legs"], seeded(5))).toEqual({
      warmup: "",
      thangs: [],
    });
  });
});
