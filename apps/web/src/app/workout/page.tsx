"use client";

import {
  formatBackblast,
  formatDate,
  workoutDates,
  type Workout,
} from "@rocket/core";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { CopyButton } from "@/components/copy-button";
import {
  ArchiveIcon,
  ArrowIcon,
  CopyIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { ShareButton } from "@/components/share-button";
import {
  addWorkoutDate,
  fromWorkoutRow,
  loadWorkoutNotes,
} from "@/lib/backblast";
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
  const text = formatBackblast(workout, user.language);
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
        {text}
      </pre>
      {notes && (
        <section className="flex flex-col gap-2 rounded-2xl border border-line p-4">
          <h2 className="text-xs font-semibold tracking-wider text-accent uppercase">
            Your notes · only you see these
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
            {notes}
          </p>
        </section>
      )}

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
          // Running it again adds a date to this workout (below), rather than copying it.
          <a href="#dates" className="btn w-full">
            <CopyIcon />
            Reuse
          </a>
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
        onDatesChange={(moreDates) =>
          setResult((current) =>
            current?.workout
              ? { ...current, workout: { ...current.workout, moreDates } }
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
 * The days this workout is run, each with its backblast button, and (for its Q) a way to add
 * another day to run it again.
 */
function WorkoutDates({
  workoutId,
  workout,
  mine,
  backblasts,
  onDatesChange,
}: {
  workoutId: string;
  workout: Workout;
  mine: boolean;
  backblasts: { id: string; status: string; date: string | null }[];
  onDatesChange: (moreDates: string[]) => void;
}) {
  const dates = workoutDates(workout);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!adding) return;
    setBusy(true);
    setError(null);
    try {
      onDatesChange(await addWorkoutDate(workoutId, adding));
      setAdding("");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <section id="dates" className="flex scroll-mt-4 flex-col gap-3">
      {dates.length > 1 && (
        <h2 className="text-lg font-semibold tracking-tight text-ink">Dates</h2>
      )}
      {dates.length === 1 ? (
        <Link
          href={backblastLink(workoutId, dates[0]!, backblasts).href}
          className="btn w-full"
        >
          <ArrowIcon />
          {backblastLink(workoutId, dates[0]!, backblasts).label}
        </Link>
      ) : (
        <ul className="panel flex flex-col divide-y divide-line p-2">
          {dates.map((date) => {
            const link = backblastLink(workoutId, date, backblasts);
            return (
              <li
                key={date}
                className="flex items-center justify-between gap-3 px-2 py-2.5"
              >
                <span className="text-sm text-ink">{formatDate(date)}</span>
                <Link href={link.href} className="btn px-3 py-1.5 text-sm">
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {mine && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="label flex flex-1 flex-col gap-1.5">
            Run it again on
            <input
              type="date"
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              className="input text-base"
            />
          </label>
          <button
            type="button"
            disabled={!adding || busy}
            onClick={add}
            className="btn px-4 disabled:opacity-50"
          >
            <PlusIcon />
            {busy ? "Adding…" : "Add date"}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-accent">{error}</p>}
    </section>
  );
}
