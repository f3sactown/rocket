"use client";

import {
  DEFAULT_INTRODUCTION,
  FIA_DISCLAIMER,
  type Backblast,
  type Language,
  type Workout,
} from "@rocket/core";
import { addDays } from "../../../../supabase/functions/_shared/reminders";
import { toInsert, toWorkoutInsert } from "./backblast";
import { localToday } from "./backblast-list";
import { createClient } from "./supabase/client";

/** Their names start with this, so they read as examples. */
const PREFIX = "Example:";
/** Their AO, made up so it can't be taken for a real one. */
const AO = "Example AO";

function exampleWorkout(language: Language, q: string): Workout {
  return {
    title: `${PREFIX} Hill Repeats`,
    // Yesterday, so it has happened and is ready for its backblast.
    date: addDays(localToday(), -1),
    ao: AO,
    time: "5:15am-6:00am",
    q,
    attendees: [],
    introduction: language === "fia" ? FIA_DISCLAIMER : DEFAULT_INTRODUCTION,
    warmup: "SSH x 20\nImperial Walkers x 15\nMountain Climbers x 15",
    thangs: [
      {
        text: "Hill repeats: run up, 10 merkins at the top, jog down. Every minute on the minute.",
        timer: { type: "emom", every: 60, rounds: 10 },
      },
      {
        text: "Mary: flutter kicks, LBCs and American hammers, 20 each.",
        timer: { type: "countdown", seconds: 300 },
      },
    ],
    notes:
      "This is an example to show how a workout looks. Edit it, archive it or delete it from its page.",
    wordsOfWisdom: "Show up, push hard, and encourage those around you.",
  };
}

function exampleBackblast(q: string): Backblast {
  return {
    title: `${PREFIX} Coupon Carnage`,
    // Another day, so it isn't linked to the example workout (which then still needs one).
    date: addDays(localToday(), -2),
    ao: AO,
    time: "5:30am-6:15am",
    q,
    attendees: [
      { name: "Tinman", kind: "pax" },
      { name: "Bolt", kind: "pax" },
      { name: "Hops", kind: "fng", invitedBy: q },
    ],
    warmup: "SSH x 20\nWindmills x 10",
    thang:
      "Coupon curls, presses and squats: 3 rounds of 15 each, with a lap of the lot between rounds.",
    notes:
      "This is an example to show how a backblast looks. Edit it, archive it or delete it from its page.",
    announcements: "Convergence next Saturday (example).",
    wordsOfWisdom: "Iron sharpens iron.",
    secondF: "Coffeeteria at the bakery after.",
  };
}

/**
 * Gives a new account something to look at, and for the app tour to show: an example workout
 * (dated yesterday, so it's ready for its backblast) and an example backblast, both private, their
 * names starting "Example:". Only for an account with no workouts or backblasts at all, and only
 * once (`examples_added` in the account's metadata), so deleting them doesn't bring them back.
 * Returns whether it added them.
 */
export function addExamplesIfEmpty(user: ExampleUser): Promise<boolean> {
  if (user.examplesAdded) return Promise.resolve(false);
  // One check per account at a time, however many times Home loads meanwhile.
  let check = checks.get(user.id);
  if (!check) {
    check = addExamples(user);
    checks.set(user.id, check);
  }
  return check;
}

type ExampleUser = {
  id: string;
  name: string;
  language: Language;
  examplesAdded: boolean;
};
const checks = new Map<string, Promise<boolean>>();

async function addExamples(user: ExampleUser): Promise<boolean> {
  const supabase = createClient();
  const [workouts, backblasts] = await Promise.all([
    supabase.from("workouts").select("id").eq("author_id", user.id).limit(1),
    supabase.from("backblasts").select("id").eq("author_id", user.id).limit(1),
  ]);
  if (workouts.error || backblasts.error) return false;
  const empty = !workouts.data?.length && !backblasts.data?.length;
  if (empty) {
    const { error: workoutError } = await supabase.from("workouts").insert({
      ...toWorkoutInsert(exampleWorkout(user.language, user.name)),
      status: "published",
      visibility: "private",
      author_id: user.id,
    });
    if (workoutError) return false;
    await supabase.from("backblasts").insert({
      ...toInsert(exampleBackblast(user.name)),
      status: "published",
      visibility: "private",
      author_id: user.id,
    });
  }
  // Checked once either way: someone with workouts of their own never gets examples.
  await supabase.auth.updateUser({ data: { examples_added: true } });
  return empty;
}
