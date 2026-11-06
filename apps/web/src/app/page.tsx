"use client";

import { formatDate, type Language } from "@rocket/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { BackblastList } from "@/components/backblast-list";
import { PlusIcon } from "@/components/icons";
import { WorkoutCards } from "@/components/workout-card";
import {
  loadFutureWorkouts,
  loadLists,
  type ListItem,
} from "@/lib/backblast-list";
import { loadPublicWorkouts, trending } from "@/lib/discover";
import type { WorkoutStats } from "@/lib/workout-social";
import { loadLatestPost, loadPaxStats } from "@/lib/regions";
import { useLoad, useUserRegion } from "@/lib/use-region";

export default function Home() {
  return <SignedIn>{(user) => <HomePage user={user} />}</SignedIn>;
}

/** How many of each kind the home page shows. */
const RECENT = 5;

/**
 * The first page. It shows the sections chosen in Settings → Home screen, in a fixed order: your
 * totals, your drafts, your future workouts, trending workouts, and the latest workouts and
 * backblasts.
 */
function HomePage({ user }: { user: CurrentUser }) {
  const show = new Set(user.homeSections);
  const [lists, setLists] = useState<{
    drafts: ListItem[];
    future: ListItem[];
    workouts: ListItem[];
    backblasts: ListItem[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hot, setHot] = useState<{
    workouts: ListItem[];
    stats: Map<string, WorkoutStats>;
  } | null>(null);
  const wantsTrending = show.has("trending");
  // With Future workouts shown, Recent workouts keeps to ones dated today or earlier.
  const wantsFuture = show.has("upcoming");
  const sources = user.publicSources.join();

  useEffect(() => {
    Promise.all([
      loadLists("workout", user.id, RECENT, wantsFuture),
      loadLists("backblast", user.id, RECENT),
      wantsFuture ? loadFutureWorkouts(user.id, RECENT) : [],
    ]).then(
      ([workouts, backblasts, future]) =>
        setLists({
          drafts: [...workouts.drafts, ...backblasts.drafts],
          future,
          workouts: workouts.published,
          backblasts: backblasts.published,
        }),
      (e: Error) => setError(e.message),
    );
  }, [user.id, wantsFuture]);

  useEffect(() => {
    if (!wantsTrending) return;
    loadPublicWorkouts(sources.split(",") as Language[]).then(
      ({ workouts, stats }) =>
        setHot({ workouts: trending(workouts, stats).slice(0, RECENT), stats }),
      () => setHot({ workouts: [], stats: new Map() }),
    );
  }, [wantsTrending, user.id, sources]);

  return (
    <section className="card">
      <header className="flex flex-col gap-1">
        <h1 className="card-title">Hey, {user.name}</h1>
      </header>
      {show.has("totals") && <Totals user={user} />}

      {error ? (
        <p className="panel px-3 py-8 text-center text-accent">{error}</p>
      ) : !lists ? (
        <p className="panel px-3 py-8 text-center text-muted">Loading…</p>
      ) : (
        <>
          {show.has("drafts") && lists.drafts.length > 0 && (
            <Recent title="Your drafts">
              <BackblastList user={user} groups={[{ items: lists.drafts }]} />
            </Recent>
          )}
          {wantsFuture && (
            <Recent title="Future workouts" href="/workouts">
              <BackblastList
                user={user}
                groups={[
                  {
                    items: lists.future,
                    empty:
                      "Nothing planned yet. Workouts dated after today show here.",
                  },
                ]}
              />
            </Recent>
          )}
          {wantsTrending && (
            <Recent title="Trending workouts" href="/discover">
              {!hot ? (
                <p className="panel px-3 py-8 text-center text-muted">
                  Loading…
                </p>
              ) : hot.workouts.length === 0 ? (
                <p className="panel px-3 py-8 text-center text-muted">
                  Nothing trending yet.
                </p>
              ) : (
                <WorkoutCards
                  tiles
                  workouts={hot.workouts}
                  stats={hot.stats}
                  userId={user.id}
                  onStatsChange={(id, next) =>
                    setHot(
                      (current) =>
                        current && {
                          ...current,
                          stats: new Map(current.stats).set(id, next),
                        },
                    )
                  }
                />
              )}
            </Recent>
          )}
          {show.has("workouts") && (
            <Recent title="Recent workouts" href="/workouts">
              <BackblastList
                user={user}
                groups={[{ items: lists.workouts, empty: "No workouts yet." }]}
              />
            </Recent>
          )}
          {show.has("backblasts") && (
            <Recent title="Recent backblasts" href="/backblasts">
              <BackblastList
                user={user}
                groups={[
                  { items: lists.backblasts, empty: "No backblasts yet." },
                ]}
              />
            </Recent>
          )}
        </>
      )}

      <Link href="/workouts/new" className="btn w-full">
        <PlusIcon />
        New workout
      </Link>
    </section>
  );
}

/** A heading, with a link to the full list if there is one, above a short list. */
function Recent({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {href && (
          <Link href={href} className="link text-sm">
            See all →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

/** Your total posts and Qs from your region's sheet, big and outlined in the accent color. */
function Totals({ user }: { user: CurrentUser }) {
  const region = useUserRegion();
  const stats = useLoad(region ? () => loadPaxStats(region, user.name) : null, [
    region?.id,
    user.name,
  ]);
  const latest = useLoad(region ? () => loadLatestPost(region) : null, [
    region?.id,
  ]);
  if (region === null)
    return (
      <Link href="/settings" className="link">
        Choose your region in Settings to see your posts and Qs →
      </Link>
    );
  const tile = (label: string, value: number | undefined) => (
    <div
      className="flex flex-col items-center gap-1 rounded-2xl border py-5"
      style={{
        // Outlined in the accent color the user chose.
        borderColor: "var(--accent)",
        boxShadow:
          "0 0 16px color-mix(in srgb, var(--accent) 25%, transparent)",
      }}
    >
      <span className="font-mono text-4xl text-ink">
        {value ?? (stats.error ? "–" : "…")}
      </span>
      <span className="text-sm text-ink-soft">{label}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        {tile("Posts", stats.value?.posts)}
        {tile("Qs", stats.value?.qs)}
      </div>
      <p className="text-center text-xs text-muted">
        {stats.error
          ? `Totals unavailable: ${stats.error}`
          : (region?.name ?? "")}
        {latest.value && (
          <span className="block">Updated {formatDate(latest.value)}</span>
        )}
      </p>
    </div>
  );
}
