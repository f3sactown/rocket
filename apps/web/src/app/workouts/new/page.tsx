"use client";

import type { Workout } from "@rocket/core";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { BackblastEditor } from "@/components/backblast-editor";
import { fromWorkoutRow, loadWorkoutNotes, workoutById } from "@/lib/backblast";

export default function NewWorkoutPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <SignedIn>{(user) => <NewWorkout user={user} />}</SignedIn>
    </Suspense>
  );
}

const BLANK: Workout = { title: "", date: "", ao: "", q: "", attendees: [] };

/**
 * A new workout; with ?from=…, it starts as a copy of that workout (to run it again), without its
 * AO, location, date or time, so those are chosen for the new run.
 */
function NewWorkout({ user }: { user: CurrentUser }) {
  // Read once: saving the first draft changes the address to its edit link, dropping ?from=.
  const fromParam = useSearchParams().get("from");
  const [fromId] = useState(fromParam);
  const [from, setFrom] = useState<Workout | string | null>(null);

  useEffect(() => {
    if (!fromId) return;
    workoutById(fromId).then(async ({ data, error }) => {
      if (error || !data)
        return setFrom(error?.message ?? "That workout is gone.");
      // Your own notes come along; someone else's stay private.
      const notes =
        data.author_id === user.id ? await loadWorkoutNotes(data.id) : "";
      // Where and when are chosen fresh for the new run: no AO, location, date or time.
      setFrom({
        ...fromWorkoutRow(data, notes),
        ao: "",
        address: undefined,
        date: "",
        time: undefined,
        // Counted as a reuse of the original.
        reusedFrom: data.id,
        // A reuse of a reuse still credits whoever wrote the first one.
        originalAuthorId: data.original_author_id ?? data.author_id,
      });
    });
  }, [fromId, user.id]);

  if (!fromId)
    return <BackblastEditor mode="workout" user={user} initial={BLANK} />;
  if (from === null) return <div className="card h-96 animate-pulse" />;
  if (typeof from === "string")
    return (
      <section className="card">
        <h1 className="card-title">Workout not found</h1>
        <p className="text-accent">{from}</p>
      </section>
    );
  return (
    <BackblastEditor key={fromId} mode="workout" user={user} initial={from} />
  );
}
