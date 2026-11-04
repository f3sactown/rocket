"use client";

import { copyWorkout, type Backblast } from "@rocket/core";
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

/** A new backblast; with ?workout=…, it starts as a copy of that workout's sections. */
function NewBackblast({ user }: { user: CurrentUser }) {
  // Read once: saving the first draft changes the address to its edit link, dropping ?workout=.
  const params = useSearchParams();
  const [workoutId] = useState(params.get("workout"));
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
      initial={copyWorkout({ ...blank, workoutId }, from)}
    />
  );
}
