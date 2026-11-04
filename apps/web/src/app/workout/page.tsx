"use client";

import {
  formatBackblast,
  formatDate,
  workoutDates,
  workoutRuns,
  type Workout,
  type WorkoutRun,
} from "@rocket/core";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  SignedIn,
  type CurrentUser,
  type SwipeAction,
} from "@/components/auth-provider";
import { CopyButton } from "@/components/copy-button";
import {
  ArchiveIcon,
  ArrowIcon,
  CopyIcon,
  PencilIcon,
  PlayIcon,
  TrashIcon,
} from "@/components/icons";
import { ShareButton } from "@/components/share-button";
import {
  addWorkoutRun,
  fromWorkoutRow,
  loadWorkoutNotes,
  removeWorkoutRun,
} from "@/lib/backblast";
import { ReuseWorkout } from "@/components/reuse-workout";
import { SwipeRow } from "@/components/swipe-row";
import { archive, deleteItem, unarchive } from "@/lib/backblast-list";
import { createClient } from "@/lib/supabase/client";

// A query parameter instead of /workouts/[id], because a static site can't serve dynamic paths.
export default function WorkoutPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <SignedIn>{(user) => <WorkoutDetail user={user} />}</SignedIn>
    </Suspense>
  );
}

/** A finished workout, with a button to write its backblast. */
function WorkoutDetail({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [result, setResult] = useState<{
    workout: Workout | null;
    authorId?: string;
    authorName?: string;
    status?: string;
    error?: string;
  } | null>(null);
  // The Q's private notes, readable only by the workout's author.
  const [notes, setNotes] = useState("");
  // Backblasts you've already written from this workout.
  const [backblasts, setBackblasts] = useState<
    { id: string; title: string; status: string; date: string | null }[]
  >([]);
  const [archived, setArchived] = useState<boolean | null>(null);
  const [reusing, setReusing] = useState(false);
  // Every backblast made from this workout that you can see, to know which dates are written up.
  const [allBackblasts, setAllBackblasts] = useState<{ date: string | null }[]>(
    [],
  );
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    supabase
      .from("workouts")
      .select("*, author:profiles!workouts_author_id_fkey(name)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (data?.author_id === user.id)
          loadWorkoutNotes(data.id).then(setNotes);
        setResult({
          workout: data && fromWorkoutRow(data),
          authorId: data?.author_id,
          authorName: (data as { author?: { name: string } } | null)?.author
            ?.name,
          status: data?.status,
          error: error?.message,
        });
      });
    supabase
      .from("backblasts")
      .select("id, title, status, date")
      .eq("workout_id", id)
      .eq("author_id", user.id)
      .then(({ data }) => setBackblasts(data ?? []));
    supabase
      .from("backblasts")
      .select("date")
      .eq("workout_id", id)
      .then(({ data }) => setAllBackblasts(data ?? []));
    supabase
      .from("workout_archives")
      .select("workout_id")
      .eq("workout_id", id)
      .then(({ data }) => setArchived((data ?? []).length > 0));
  }, [id, user.id]);

  async function toggleArchive() {
    setActionError(null);
    try {
      await (archived ? unarchive(id!, "workout") : archive(id!, "workout"));
      setArchived(!archived);
    } catch (error) {
      setActionError((error as Error).message);
    }
  }

  if (id && !result) return <div className="card h-96 animate-pulse" />;
  if (!result?.workout)
    return (
      <section className="card">
        <h1 className="card-title">Workout not found</h1>
        {result?.error && <p className="text-accent">{result.error}</p>}
      </section>
    );

  const { workout } = result;
  const mine = result.authorId === user.id;
  // What's copied and shared leaves out the Q's notes; the page shows them in place for the Q.
  const text = formatBackblast(workout, user.language);
  const shown = formatBackblast({ ...workout, notes }, user.language);
  return (
    <article className="card">
      <header className="flex items-start justify-between gap-4">
        <h1 className="card-title">{workout.title}</h1>
        {result.authorName && (
          <span className="status mt-2 shrink-0" title="Written by">
            {result.authorName}
          </span>
        )}
      </header>

      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink">{workout.ao}</span>
        <span className="text-ink-soft">
          {formatDate(workout.date)}
          {workoutDates(workout).length > 1 &&
            ` + ${workoutDates(workout).length - 1} more`}
        </span>
      </div>

      <pre className="panel overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
        {shown}
      </pre>

      <Link href={`/workout/run?id=${id}`} className="btn w-full">
        <PlayIcon />
        Run workout
      </Link>
      <div className="grid grid-cols-2 gap-3">
        <CopyButton text={text} />
        <ShareButton title={workout.title} text={text} />
      </div>
      <div
        className={`-mt-2 grid gap-3 ${mine ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {mine && (
          <Link href={`/workouts/edit?id=${id}`} className="btn w-full">
            <PencilIcon />
            Edit
          </Link>
        )}
        {mine ? (
          // Running it again adds a date (and AO) to this workout, rather than copying it.
          <button
            type="button"
            onClick={() => {
              setReusing(true);
              requestAnimationFrame(() =>
                document
                  .getElementById("dates")
                  ?.scrollIntoView({ behavior: "smooth" }),
              );
            }}
            className="btn w-full"
          >
            <CopyIcon />
            Reuse
          </button>
        ) : (
          // Someone else's workout can't be changed, so it's copied into your own.
          <Link href={`/workouts/new?from=${id}`} className="btn w-full">
            <CopyIcon />
            Copy to my workouts
          </Link>
        )}
      </div>
      <div className="-mt-1 flex justify-center gap-6">
        {archived !== null && (
          <button
            type="button"
            onClick={toggleArchive}
            className="link inline-flex items-center gap-1.5 hover:text-ink"
          >
            <ArchiveIcon className="size-4" />
            {archived ? "Unarchive" : "Archive"}
          </button>
        )}
        {mine && (
          <button
            type="button"
            onClick={async () => {
              if (
                !confirm(
                  "Delete this workout? Backblasts made from it are kept. This can't be undone.",
                )
              )
                return;
              setActionError(null);
              try {
                await deleteItem(id!, "workout");
                router.push("/workouts");
              } catch (error) {
                setActionError((error as Error).message);
              }
            }}
            className="link inline-flex items-center gap-1.5 hover:text-accent"
          >
            <TrashIcon />
            Delete workout
          </button>
        )}
      </div>
      {actionError && <p className="text-sm text-accent">{actionError}</p>}

      <WorkoutDates
        workoutId={id!}
        workout={workout}
        mine={mine}
        backblasts={backblasts}
        reusing={reusing}
        onReusingChange={setReusing}
        swipeLeft={user.swipeLeft}
        written={allBackblasts.map((b) => b.date)}
        onWorkoutChange={(update) =>
          setResult((current) =>
            current?.workout
              ? { ...current, workout: { ...current.workout, ...update } }
              : current,
          )
        }
      />
    </article>
  );
}

/** Where a date's backblast button goes: your backblast for that date, or a new one. */
function backblastLink(
  workoutId: string,
  date: string,
  backblasts: { id: string; status: string; date: string | null }[],
) {
  const existing = backblasts.find((b) => b.date === date);
  if (!existing)
    return {
      href: `/backblasts/new?workout=${workoutId}&date=${date}`,
      label: "Create backblast",
    };
  return existing.status === "draft"
    ? {
        href: `/backblasts/edit?id=${existing.id}`,
        label: "Continue backblast",
      }
    : { href: `/backblast?id=${existing.id}`, label: "Open backblast" };
}

/**
 * The days this workout is run, each with its backblast button. Its Q can add another day (and
 * AO) with Reuse, and remove a day nobody has written a backblast for.
 */
function WorkoutDates({
  workoutId,
  workout,
  mine,
  backblasts,
  written,
  reusing,
  onReusingChange,
  onWorkoutChange,
  swipeLeft,
}: {
  workoutId: string;
  workout: Workout;
  mine: boolean;
  backblasts: { id: string; status: string; date: string | null }[];
  /** The dates that have a backblast, by anyone. */
  written: (string | null)[];
  reusing: boolean;
  onReusingChange: (reusing: boolean) => void;
  onWorkoutChange: (update: Partial<Workout>) => void;
  /** Which way the user swipes to delete (Settings). */
  swipeLeft: SwipeAction;
}) {
  const runs = workoutRuns(workout);
  const [error, setError] = useState<string | null>(null);

  // The date just removed, offered back with Undo for a few seconds.
  const [removed, setRemoved] = useState<WorkoutRun | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function remove(run: WorkoutRun) {
    setError(null);
    try {
      const saved = await removeWorkoutRun(workoutId, run.date);
      onWorkoutChange({
        date: saved.date,
        ao: saved.ao,
        address: saved.address,
        time: saved.time,
        runs: saved.runs,
      });
      setRemoved(run);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setRemoved(null), 6000);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function undo() {
    if (!removed) return;
    const run = removed;
    setRemoved(null);
    try {
      onWorkoutChange({ runs: await addWorkoutRun(workoutId, run) });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Swiping the way that deletes (set in Settings) removes a date.
  const removeOption = (run: WorkoutRun) => ({
    label: "Remove",
    color: "#c8372d",
    onCommit: () => remove(run),
  });

  return (
    <section id="dates" className="flex scroll-mt-4 flex-col gap-3">
      {runs.length > 1 && (
        <h2 className="text-lg font-semibold tracking-tight text-ink">Dates</h2>
      )}
      {runs.length === 1 ? (
        <Link
          href={backblastLink(workoutId, runs[0]!.date, backblasts).href}
          className="btn w-full"
        >
          <ArrowIcon />
          {backblastLink(workoutId, runs[0]!.date, backblasts).label}
        </Link>
      ) : (
        <ul className="panel flex flex-col divide-y divide-line p-2">
          {runs.map((run) => {
            const link = backblastLink(workoutId, run.date, backblasts);
            const removable = mine && !written.includes(run.date);
            return (
              <li key={run.date}>
                <SwipeRow
                  left={
                    removable && swipeLeft === "delete"
                      ? removeOption(run)
                      : undefined
                  }
                  right={
                    removable && swipeLeft === "archive"
                      ? removeOption(run)
                      : undefined
                  }
                >
                  <div className="flex items-center justify-between gap-3 px-2 py-2.5">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm text-ink">
                        {formatDate(run.date)}
                      </span>
                      <span className="truncate text-xs text-muted">
                        {[run.ao, run.time].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <Link
                      href={link.href}
                      className="btn shrink-0 px-3 py-1.5 text-sm"
                    >
                      {link.label}
                    </Link>
                  </div>
                </SwipeRow>
              </li>
            );
          })}
        </ul>
      )}
      {mine && reusing && (
        <ReuseWorkout
          taken={runs.map((r) => r.date)}
          onCancel={() => onReusingChange(false)}
          onAdd={async (run) => {
            const added = await addWorkoutRun(workoutId, run);
            onWorkoutChange({ runs: added });
            onReusingChange(false);
          }}
        />
      )}
      {mine && runs.length > 1 && !removed && (
        <p className="-mt-1 text-xs text-muted">
          Swipe a date {swipeLeft === "delete" ? "left" : "right"} to remove it,
          if it has no backblast.
        </p>
      )}
      {removed && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-line-strong px-3 py-2 text-sm"
        >
          <span className="text-ink">Removed {formatDate(removed.date)}</span>
          <button
            type="button"
            onClick={undo}
            className="font-semibold text-accent"
          >
            Undo
          </button>
        </div>
      )}
      {error && <p className="text-sm text-accent">{error}</p>}
    </section>
  );
}
