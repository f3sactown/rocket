"use client";

import { copyWorkout, workoutRuns, type Backblast } from "@rocket/core";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { BackblastEditor } from "@/components/backblast-editor";
import { loadWorkout } from "@/lib/backblast";

export default function NewBackblastPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <SignedIn>{(user) => <NewBackblast user={user} />}</SignedIn>
    </Suspense>
  );
}

/** A backblast for one of the workout's runs: that day's date, AO, location and time. */
function forRun(backblast: Backblast, workout: Backblast, date: string | null) {
  const run = date && workoutRuns(workout).find((r) => r.date === date);
  return run
    ? {
        ...backblast,
        date: run.date,
        ao: run.ao,
        address: run.address,
        time: run.time,
      }
    : backblast;
}

/** A new backblast; with ?workout=…, it starts as a copy of that workout's sections. */
function NewBackblast({ user }: { user: CurrentUser }) {
  // Read once: saving the first draft changes the address to its edit link, dropping ?workout=.
  const params = useSearchParams();
  const [workoutId] = useState(params.get("workout"));
  // Which of the workout's days this backblast is for, when it's run on more than one.
  const [date] = useState(params.get("date"));
  const blank: Backblast = {
    title: "",
    date: "",
    ao: "",
    q: user.name,
    attendees: [],
  };
  const [from, setFrom] = useState<Backblast | string | null>(null);

  useEffect(() => {
    if (workoutId) loadWorkout(workoutId).then(setFrom);
  }, [workoutId]);

  if (!workoutId) return <BackblastEditor user={user} initial={blank} />;
  if (from === null) return <div className="card h-96 animate-pulse" />;
  if (typeof from === "string")
    return (
      <section className="card">
        <h1 className="card-title">Workout not found</h1>
        <p className="text-accent">{from}</p>
      </section>
    );
  return (
    <BackblastEditor
      key={workoutId}
      user={user}
      initial={forRun(copyWorkout({ ...blank, workoutId }, from), from, date)}
    />
  );
}
