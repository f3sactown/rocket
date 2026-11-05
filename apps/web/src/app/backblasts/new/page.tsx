"use client";

import { copyWorkout, type Backblast } from "@rocket/core";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { BackblastEditor } from "@/components/backblast-editor";
import { PlusIcon } from "@/components/icons";
import { loadWorkout } from "@/lib/backblast";
import { loadWorkoutsNeedingBackblast } from "@/lib/backblast-list";
import { useLoad } from "@/lib/use-region";

export default function NewBackblastPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <SignedIn>{(user) => <NewBackblast user={user} />}</SignedIn>
    </Suspense>
  );
}

/**
 * A new backblast. With ?workout=…, it starts as a copy of that workout's sections; without one,
 * it first asks which workout it's for (those still needing a backblast), or to start without.
 */
function NewBackblast({ user }: { user: CurrentUser }) {
  // Read once: saving the first draft changes the address to its edit link, dropping ?workout=.
  const params = useSearchParams();
  // The chosen workout, or null while choosing (unless starting without one).
  const [workoutId, setWorkoutId] = useState<string | null>(
    params.get("workout"),
  );
  const [withoutWorkout, setWithoutWorkout] = useState(false);
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

  if (withoutWorkout) return <BackblastEditor user={user} initial={blank} />;
  if (!workoutId)
    return (
      <ChooseWorkout
        onChoose={(id) => {
          // Keep the choice in the address, so a reload before the first save returns here.
          window.history.replaceState(
            null,
            "",
            `${process.env.NEXT_PUBLIC_BASE_PATH}/backblasts/new/?workout=${id}`,
          );
          setWorkoutId(id);
        }}
        onWithout={() => setWithoutWorkout(true)}
      />
    );
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

/** Asks which workout the new backblast is for, or to start one without a workout. */
function ChooseWorkout({
  onChoose,
  onWithout,
}: {
  onChoose: (workoutId: string) => void;
  onWithout: () => void;
}) {
  const workouts = useLoad(loadWorkoutsNeedingBackblast, []);
  return (
    <section className="card">
      <header className="flex flex-col gap-1">
        <h1 className="card-title">New backblast</h1>
        <p className="text-sm text-muted">
          Which workout is it for? These finished workouts don&apos;t have a
          backblast yet.
        </p>
      </header>
      <div className="panel p-2">
        {workouts.error ? (
          <p className="px-3 py-8 text-center text-accent">{workouts.error}</p>
        ) : !workouts.value ? (
          <p className="px-3 py-8 text-center text-muted">Loading…</p>
        ) : workouts.value.length === 0 ? (
          <p className="px-3 py-8 text-center text-muted">
            Every finished workout has a backblast.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {workouts.value.map((workout) => (
              <li key={workout.id}>
                <button
                  type="button"
                  onClick={() => onChoose(workout.id)}
                  className="group flex w-full items-center gap-4 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-hover"
                >
                  <span className="h-8 w-0.5 shrink-0 rounded-full bg-line-strong transition-colors group-hover:bg-accent" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-ink">
                      {workout.title || "Untitled workout"}
                    </span>
                    <span className="truncate text-sm text-muted">
                      {[workout.ao, workout.author?.name]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="font-mono text-sm text-ink-soft">
                    {workout.date}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" onClick={onWithout} className="btn w-full">
        <PlusIcon />
        New backblast
      </button>
    </section>
  );
}
