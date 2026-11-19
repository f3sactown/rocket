"use client";

import { formatDate, type Language } from "@rocket/core";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { BackblastList } from "@/components/backblast-list";
import { HeartIcon, PlayIcon, PlusIcon, ReuseIcon } from "@/components/icons";
import {
  LocalDraftList,
  useOnDraftsSent,
  useOnListsChanged,
} from "@/components/local-drafts";
import { WhatsNew } from "@/components/whats-new";
import { WorkoutCards } from "@/components/workout-card";
import {
  byWorkoutDate,
  isUpcoming,
  loadFutureWorkouts,
  loadLists,
  loadTodaysWorkouts,
  type ListItem,
} from "@/lib/backblast-list";
import { useConnection } from "@/lib/connection";
import { useDeleting } from "@/lib/deleting";
import { loadPublicWorkouts, trending } from "@/lib/discover";
import {
  backblastForScreen,
  keepLater,
  MAIN_SCREENS,
  offlineWorkoutIds,
  workoutScreens,
} from "@/lib/offline";
import { loadMyTotals, type WorkoutStats } from "@/lib/workout-social";
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
  const { offline } = useConnection();
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
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    // Each list on its own: offline, any kept on this phone show even if another isn't.
    const none = { drafts: [] as ListItem[], published: [] as ListItem[] };
    Promise.allSettled([
      loadLists("workout", user.id, RECENT, wantsFuture),
      loadLists("backblast", user.id, RECENT),
      wantsFuture ? loadFutureWorkouts(user.id, RECENT) : [],
    ]).then(([w, b, f]) => {
      if (w.status === "rejected" && b.status === "rejected")
        return setError((w.reason as Error).message);
      setError(null);
      const workouts = w.status === "fulfilled" ? w.value : none;
      const backblasts = b.status === "fulfilled" ? b.value : none;
      const future = f.status === "fulfilled" ? f.value : [];
      // Copies for offline use: the main screens, and these workouts with their Run screens.
      // (Home's own, and every one from the last two weeks and coming up.)
      // Those that have happened bring their new backblast, to write it at the AO with no signal.
      offlineWorkoutIds(user.id)
        .catch(() => [] as { id: string; date: string | null }[])
        .then((recent) => {
          const all = [...future, ...workouts.published, ...recent];
          const ids = [...new Set(all.map((w) => w.id))];
          const happened = [
            ...new Set(all.filter((w) => !isUpcoming(w.date)).map((w) => w.id)),
          ];
          keepLater([
            ...MAIN_SCREENS,
            ...ids.flatMap(workoutScreens),
            ...happened.map(backblastForScreen),
            ...backblasts.published
              .slice(0, RECENT)
              .map((b) => `/backblast/?id=${b.id}`),
          ]);
        });
      setLists({
        drafts: [...workouts.drafts, ...backblasts.drafts].sort(byWorkoutDate),
        future,
        workouts: workouts.published,
        backblasts: backblasts.published,
      });
    });
  }, [user.id, wantsFuture, reloads]);

  // Drafts kept on the phone reached Rocket: load the lists again to show them.
  useOnDraftsSent(useCallback(() => setReloads((n) => n + 1), []));
  // A workout or backblast deleted or archived (perhaps just as Home opened): load them again.
  useOnListsChanged(useCallback(() => setReloads((n) => n + 1), []));

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
      <header className="flex items-start justify-between gap-3">
        <h1 className="card-title">Hey, {user.name}</h1>
        <MyTotals userId={user.id} />
      </header>
      <WhatsNew user={user} />
      {show.has("totals") && <Totals user={user} />}
      {show.has("today") && <TodaysWorkouts user={user} reloads={reloads} />}
      <LocalDraftList />

      {error ? (
        <p className="panel px-3 py-8 text-center text-accent">
          {offline || /fetch|network|load failed/i.test(error)
            ? "Your workouts and backblasts aren't kept on this phone yet: they show here once Rocket opens with a connection. You can still write a new workout or backblast now, and it's saved once you're back online."
            : error}
        </p>
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

      {/* Both work offline too: they're kept on the phone until there's a connection. */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/workouts/new"
          data-tour="home-new-workout"
          className="btn w-full"
        >
          <PlusIcon />
          New workout
        </Link>
        <Link href="/backblasts/new" className="btn w-full">
          <PlusIcon />
          New backblast
        </Link>
      </div>
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
function TodaysWorkouts({
  user,
  reloads,
}: {
  user: CurrentUser;
  reloads: number;
}) {
  const workouts = useLoad(
    () => loadTodaysWorkouts(user.id),
    [user.id, reloads],
  );
  // The time now, updated each minute so workouts drop off on their own.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  // One swiped to delete is gone at once (back if Undo is tapped).
  const deleting = useDeleting();
  const shown = (workouts.value ?? [])
    .filter((w) => !deleting.has(w.id))
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
    <div
      data-tour={`home-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`}
      className="flex flex-col gap-2"
    >
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
  // Kept on this device too, so they still show offline.
  const kept = `rocket-totals:${user.id}:${key}`;
  const stats = useLoad(
    scope
      ? () => remembered(kept, () => loadPaxStatsIn(scope.regions, user.name))
      : null,
    [key, user.name],
  );
  const latest = useLoad(
    scope
      ? () =>
          remembered(`${kept}:latest`, () => loadLatestPostIn(scope.regions))
      : null,
    [key],
  );
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
    <div data-tour="home-totals" className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        {tile("Posts", stats.value?.posts)}
        {tile("Qs", stats.value?.qs)}
      </div>
      <p className="text-center text-xs text-muted">
        {stats.error
          ? `Totals unavailable: ${stats.error}`
          : (scope?.label ?? "")}
        {stats.value?.kept && (
          <span className="block">Offline: as last seen on this phone</span>
        )}
        {latest.value && (
          <span className="block">Updated {formatDate(latest.value)}</span>
        )}
      </p>
    </div>
  );
}

/**
 * Top right of Home: the likes and reuses your workouts have had from others, with the same heart
 * and reuse icons as workout tiles.
 */
function MyTotals({ userId }: { userId: string }) {
  const totals = useLoad(() => loadMyTotals(userId), [userId]);
  const { offline } = useConnection();
  // Counted fresh only: offline, it says so where they'd be.
  if (offline || (totals.error && !totals.value))
    return (
      <span
        data-tour="home-stats"
        className="mt-2 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm text-muted"
        title="Likes and reuses show once you're back online"
      >
        <span className="size-2 rounded-full bg-muted" aria-hidden />
        Offline
      </span>
    );
  if (!totals.value) return null;
  const { likes, reuses } = totals.value;
  return (
    <div
      data-tour="home-stats"
      className="mt-2 flex shrink-0 items-center gap-4 text-sm text-ink-soft"
      title="Likes and reuses your workouts have had"
    >
      <span
        className="inline-flex items-center gap-1.5"
        aria-label={`${likes} ${likes === 1 ? "like" : "likes"}`}
      >
        <span className="text-accent">
          <HeartIcon filled={likes > 0} />
        </span>
        {likes}
      </span>
      <span
        className="inline-flex items-center gap-1.5"
        aria-label={`${reuses} ${reuses === 1 ? "reuse" : "reuses"}`}
      >
        <span className="text-accent">
          <ReuseIcon />
        </span>
        {reuses}
      </span>
    </div>
  );
}

/**
 * Loads something and keeps it on this device; when it can't be loaded (offline), the kept copy
 * instead, marked `kept`.
 */
async function remembered<T>(
  key: string,
  load: () => Promise<T>,
): Promise<T & { kept?: boolean }> {
  try {
    const value = await load();
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Not kept; it loads fresh next time.
    }
    return value as T & { kept?: boolean };
  } catch (error) {
    let kept: T | null = null;
    try {
      kept = JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
    } catch {
      kept = null;
    }
    if (kept === null) throw error;
    return typeof kept === "object"
      ? { ...kept, kept: true }
      : (kept as T & { kept?: boolean });
  }
}
