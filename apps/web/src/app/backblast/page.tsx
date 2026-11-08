"use client";

import {
  copyText,
  formatBackblast,
  formatDate,
  type Backblast,
} from "@rocket/core";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { CopyButton } from "@/components/copy-button";
import { CountPanel } from "@/components/count-panel";
import { ProtectedText } from "@/components/protected-text";
import { ShareButton } from "@/components/share-button";
import {
  VisibilitySwitch,
  type Visibility,
} from "@/components/visibility-switch";
import { ArchiveIcon, PencilIcon, TrashIcon } from "@/components/icons";
import { fromRow } from "@/lib/backblast";
import { useWorkoutLink } from "@/lib/workout-link";
import { archive, unarchive } from "@/lib/backblast-list";
import { createClient } from "@/lib/supabase/client";
import { setVisibility } from "@/lib/workout-social";

// A query parameter instead of /backblasts/[id], because a static site can't serve dynamic paths.
export default function BackblastPage() {
  return (
    <>
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <SignedIn>{(user) => <BackblastDetail user={user} />}</SignedIn>
      </Suspense>
    </>
  );
}

function BackblastDetail({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archived, setArchived] = useState<boolean | null>(null);
  const [result, setResult] = useState<{
    backblast: Backblast | null;
    authorId?: string;
    authorName?: string;
    status?: string;
    error?: string;
  } | null>(null);
  const [visibility, setVisibilityState] = useState<Visibility>("public");

  useEffect(() => {
    if (!id) return;
    createClient()
      .from("backblasts")
      .select("*, author:profiles!backblasts_author_id_fkey(name)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (data) setVisibilityState(data.visibility ?? "public");
        setResult({
          backblast: data && fromRow(data),
          authorId: data?.author_id,
          authorName: data?.author?.name,
          status: data?.status,
          error: error?.message,
        });
      });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    createClient()
      .from("backblast_archives")
      .select("backblast_id")
      .eq("backblast_id", id)
      .then(({ data }) => setArchived((data ?? []).length > 0));
  }, [id]);

  // The copied and shared text ends with a link to its workout, when it has a public one.
  const workoutLink = useWorkoutLink(result?.backblast?.workoutId);

  async function toggleArchive() {
    setDeleteError(null);
    try {
      await (archived ? unarchive(id!) : archive(id!));
      setArchived(!archived);
    } catch (error) {
      setDeleteError((error as Error).message);
    }
  }

  if (id && !result) return <div className="card h-96 animate-pulse" />;
  if (!result?.backblast)
    return (
      <section className="card">
        <h1 className="card-title">Backblast not found</h1>
        {result?.error && <p className="text-accent">{result.error}</p>}
      </section>
    );

  const { backblast } = result;
  const mine = result.authorId === user.id;
  const text = formatBackblast(backblast, user.language);
  return (
    <article className="card">
      <header className="flex items-start justify-between gap-4">
        <h1 className="card-title">{backblast.title}</h1>
        {result.authorName && (
          <span className="status mt-2 shrink-0" title="Written by">
            {result.authorName}
          </span>
        )}
      </header>

      <CountPanel backblast={backblast} />

      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink">{backblast.ao}</span>
        <span className="text-ink-soft">{formatDate(backblast.date)}</span>
      </div>
      {mine && result.status === "published" && (
        <div className="-mt-2 flex justify-end">
          <VisibilitySwitch
            value={visibility}
            label="Who can see this backblast"
            publicHint="Anyone signed in can see it on your PAX profile"
            onChange={async (next) => {
              const before = visibility;
              setVisibilityState(next);
              setDeleteError(null);
              try {
                await setVisibility(id!, next, "backblast");
              } catch (error) {
                setVisibilityState(before);
                setDeleteError((error as Error).message);
              }
            }}
          />
        </div>
      )}
      {backblast.workoutId && (
        <Link
          href={`/workout?id=${backblast.workoutId}`}
          className="link -mt-2 self-start text-sm"
        >
          From a workout →
        </Link>
      )}

      <ProtectedText
        copyText={copyText(backblast, user.language, workoutLink)}
        className="panel overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink-soft"
      >
        {text}
      </ProtectedText>

      <div className="grid grid-cols-2 gap-3">
        <CopyButton text={copyText(backblast, user.language, workoutLink)} />
        <ShareButton
          title={backblast.title}
          text={copyText(backblast, user.language, workoutLink)}
        />
      </div>
      {mine && (
        <Link href={`/backblasts/edit?id=${id}`} className="btn -mt-2 w-full">
          <PencilIcon />
          Edit backblast
        </Link>
      )}
      <div className="-mt-1 flex justify-center gap-6">
        {mine && archived !== null && (
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
              if (!confirm("Delete this backblast? This can't be undone."))
                return;
              setDeleteError(null);
              const { error } = await createClient()
                .from("backblasts")
                .delete()
                .eq("id", id!);
              if (error) setDeleteError(error.message);
              else router.push("/backblasts");
            }}
            className="link inline-flex items-center gap-1.5 hover:text-accent"
          >
            <TrashIcon />
            Delete backblast
          </button>
        )}
      </div>
      {deleteError && <p className="text-sm text-accent">{deleteError}</p>}
    </article>
  );
}
