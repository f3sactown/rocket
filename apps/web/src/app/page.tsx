"use client";

import { formatDate, type Language } from "@rocket/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { BackblastList } from "@/components/backblast-list";
import { PlayIcon, PlusIcon } from "@/components/icons";
import { WhatsNew } from "@/components/whats-new";
import { WorkoutCards } from "@/components/workout-card";
import {
  loadFutureWorkouts,
  loadLists,
  loadTodaysWorkouts,
  type ListItem,
} from "@/lib/backblast-list";
import { loadPublicWorkouts, trending } from "@/lib/discover";
import type { WorkoutStats } from "@/lib/workout-social";
import {
  endMinutes,
  loadLatestPostIn,
  loadPaxStatsIn,
  startMinutes,
} from "@/lib/regions";
import { useLoad, useRegionScope } from "@/lib/use-region";

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
        setHot({
          // Others' workouts only; yours are on Discover when you include them there.
          workouts: trending(
            workouts.filter((w) => w.author_id !== user.id),
            stats,
          ).slice(0, RECENT),
          stats,
        }),
      () => setHot({ workouts: [], stats: new Map() }),
    );
  }, [wantsTrending, user.id, sources]);

  return (
    <section className="card">
      <header className="flex flex-col gap-1">
        <h1 className="card-title">Hey, {user.name}</h1>
      </header>
      <WhatsNew user={user} />
      {show.has("totals") && <Totals user={user} />}
      {show.has("today") && <TodaysWorkouts user={user} />}

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
/** How long after a workout's end time it still shows under Today's workouts. */
const TODAY_GRACE_MINUTES = 60;

/**
 * Your finished workouts dated today, by start time; tap one to run it. Each drops off an hour
 * after its end time (one with no time stays all day), and the section hides when none are left.
 */
function TodaysWorkouts({ user }: { user: CurrentUser }) {
  const workouts = useLoad(() => loadTodaysWorkouts(user.id), [user.id]);
  // The time now, updated each minute so workouts drop off on their own.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const shown = (workouts.value ?? [])
    .filter((w) => endMinutes(w.time ?? "") + TODAY_GRACE_MINUTES > minutesNow)
    .sort(
      (a, b) =>
        startMinutes(a.time ?? "") - startMinutes(b.time ?? "") ||
        a.title.localeCompare(b.title),
    );
  if (!shown.length) return null;
  return (
    <Recent title="Today's workouts">
      <ul className="panel flex flex-col divide-y divide-line p-2">
        {shown.map((workout) => (
          <li key={workout.id}>
            <Link
              href={`/workout/run?id=${workout.id}`}
              className="group flex items-center gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-hover"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-ink">
                  {workout.title || "Untitled workout"}
                </span>
                <span className="truncate text-sm text-muted">
                  {[workout.ao, workout.time].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-accent">
                <PlayIcon />
                Run
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Recent>
  );
}

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
  // Your region, or (with "all F3 or FiA regions") every one of them added up.
  const scope = useRegionScope();
  const key = scope?.regions.map((r) => r.id).join() ?? "";
  const stats = useLoad(
    scope ? () => loadPaxStatsIn(scope.regions, user.name) : null,
    [key, user.name],
  );
  const latest = useLoad(scope ? () => loadLatestPostIn(scope.regions) : null, [
    key,
  ]);
  if (scope === null)
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
          : (scope?.label ?? "")}
        {latest.value && (
          <span className="block">Updated {formatDate(latest.value)}</span>
        )}
      </p>
    </div>
  );
}
