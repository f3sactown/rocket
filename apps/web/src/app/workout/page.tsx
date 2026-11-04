"use client";

import { formatBackblast, formatDate, type Workout } from "@rocket/core";
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
  TrashIcon,
} from "@/components/icons";
import { ShareButton } from "@/components/share-button";
import { fromWorkoutRow, loadWorkoutNotes } from "@/lib/backblast";
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
        <span className="text-ink-soft">{formatDate(workout.date)}</span>
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
        {/* Starts a new workout with this one's sections, for running it again. */}
        <Link href={`/workouts/new?from=${id}`} className="btn w-full">
          <CopyIcon />
          Reuse
        </Link>
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

      {(() => {
        // One backblast per workout: open yours if you've started it.
        const existing = backblasts[0];
        const href = !existing
          ? `/backblasts/new?workout=${id}`
          : existing.status === "draft"
            ? `/backblasts/edit?id=${existing.id}`
            : `/backblast?id=${existing.id}`;
        return (
          <Link href={href} className="btn w-full">
            <ArrowIcon />
            {!existing
              ? "Create backblast"
              : existing.status === "draft"
                ? "Continue your backblast"
                : "Open your backblast"}
          </Link>
        );
      })()}
    </article>
  );
}
