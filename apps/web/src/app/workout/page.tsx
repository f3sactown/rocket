"use client";

import { BackblastNotYet } from "@/components/backblast-not-yet";

import { formatBackblast, formatDate, type Workout } from "@rocket/core";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { CopyButton } from "@/components/copy-button";
import { ProtectedText } from "@/components/protected-text";
import {
  ArchiveIcon,
  ArrowIcon,
  CopyIcon,
  PencilIcon,
  PlayIcon,
  TrashIcon,
} from "@/components/icons";
import { ShareButton } from "@/components/share-button";
import { ShareLinkButton } from "@/components/share-link-button";
import { VisibilitySwitch } from "@/components/visibility-switch";
import { WorkoutStatsBar } from "@/components/workout-stats";
import {
  loadWorkoutStats,
  NO_STATS,
  setVisibility,
  type WorkoutStats,
} from "@/lib/workout-social";
import {
  fromWorkoutRow,
  loadWorkoutNotes,
  workoutById,
  type WorkoutRow,
} from "@/lib/backblast";
import {
  archive,
  deleteItem,
  unarchive,
  isUpcoming,
} from "@/lib/backblast-list";
import { createClient } from "@/lib/supabase/client";

// A query parameter instead of /workouts/[id], because a static site can't serve dynamic paths.
export default function WorkoutPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <SignedIn>{(user) => <WorkoutDetail user={user} />}</SignedIn>
    </Suspense>
  );
}

/** The original author's name and, when they have one, their region: "Tinman · F3 SacTown". */
function originalAuthor(
  author: { name: string; region?: { name: string } | null } | null | undefined,
): string {
  if (!author) return "a former member";
  return author.region?.name
    ? `${author.name} · ${author.region.name}`
    : author.name;
}

/** A finished workout, with a button to write its backblast. */
function WorkoutDetail({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [result, setResult] = useState<{
    workout: Workout | null;
    authorId?: string;
    authorName?: string;
    /** Who wrote the first workout in a chain of reuses, when that's someone else. */
    originalAuthorName?: string;
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
  const [stats, setStats] = useState<WorkoutStats>(NO_STATS);
  const [visibility, setVisibilityState] = useState<"public" | "private">(
    "public",
  );

  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    // By its link: a public workout dated after today opens here though it isn't listed yet.
    workoutById<WorkoutRow & { author?: { name: string } | null }>(
      id,
      "*, author:profiles!workouts_author_id_fkey(name), original_author:profiles!workouts_original_author_id_fkey(name, region:regions!profiles_region_id_fkey(name))",
    ).then(({ data, error }) => {
      if (data?.author_id === user.id) loadWorkoutNotes(data.id).then(setNotes);
      if (data) setVisibilityState(data.visibility ?? "public");
      setResult({
        workout: data && fromWorkoutRow(data),
        authorId: data?.author_id,
        authorName: (data as { author?: { name: string } } | null)?.author
          ?.name,
        originalAuthorName:
          data?.original_author_id && data.original_author_id !== data.author_id
            ? originalAuthor(
                (
                  data as {
                    original_author?: {
                      name: string;
                      region?: { name: string } | null;
                    } | null;
                  }
                ).original_author,
              )
            : undefined,
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
    loadWorkoutStats([id]).then(
      (all) => setStats(all.get(id) ?? NO_STATS),
      () => {},
    );
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
      {result.originalAuthorName && (
        <p className="-mt-2 text-sm text-ink-soft">
          Originally by{" "}
          <span className="font-medium text-ink">
            {result.originalAuthorName}
          </span>
        </p>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink">{workout.ao}</span>
        <span className="text-ink-soft">{formatDate(workout.date)}</span>
      </div>
      <div className="-mt-2 flex flex-wrap items-center justify-between gap-3">
        <WorkoutStatsBar
          workoutId={id!}
          stats={stats}
          // You can like someone else's public workout, not your own.
          // Likes open on the workout's day, when it's listed for everyone.
          canLike={
            !mine && result.status === "published" && !isUpcoming(workout.date)
          }
          onChange={setStats}
        />
        {mine && result.status === "published" && (
          <VisibilitySwitch
            value={visibility}
            onChange={async (next) => {
              const before = visibility;
              setVisibilityState(next);
              setActionError(null);
              try {
                await setVisibility(id!, next);
              } catch (error) {
                setVisibilityState(before);
                setActionError((error as Error).message);
              }
            }}
          />
        )}
      </div>

      <ProtectedText
        copyText={text}
        className="panel overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink-soft"
      >
        {shown}
      </ProtectedText>

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
      <div className="-mt-1 flex flex-wrap justify-center gap-x-6 gap-y-2">
        <ShareLinkButton
          path={`/workout/?id=${id}`}
          blocked={
            result.status !== "published"
              ? "Finish it to share a link"
              : visibility === "private"
                ? "Make it public to share a link"
                : undefined
          }
        />
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
            Delete
          </button>
        )}
      </div>
      {actionError && <p className="text-sm text-accent">{actionError}</p>}

      {/* Only the workout's Q writes its backblast. */}
      {mine &&
        (() => {
          // One backblast per workout: open yours if you've started it.
          const existing = backblasts[0];
          if (!existing && isUpcoming(workout.date))
            return <BackblastNotYet date={workout.date!} />;
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
