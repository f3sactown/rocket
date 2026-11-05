"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { WorkoutStatsBar } from "@/components/workout-stats";
import { asItems, listColumns, type ListItem } from "@/lib/backblast-list";
import { loadSites } from "@/lib/regions";
import { createClient } from "@/lib/supabase/client";
import { useLoad, useUserRegion } from "@/lib/use-region";
import {
  loadWorkoutStats,
  NO_STATS,
  type WorkoutStats,
} from "@/lib/workout-social";

export default function DiscoverPage() {
  return <SignedIn>{(user) => <Discover user={user} />}</SignedIn>;
}

/** How many workouts each group shows. */
const PER_GROUP = 8;

/** Public workouts from everyone, newest first. */
async function loadPublicWorkouts(): Promise<ListItem[]> {
  const { data, error } = await createClient()
    .from("workouts")
    .select(listColumns("workout"))
    .eq("status", "published")
    .eq("visibility", "public")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return asItems("workout", data);
}

/**
 * Public workouts to browse, in groups: most liked, most reused, at your region's AOs, and newest.
 * Like someone else's straight from the list.
 */
function Discover({ user }: { user: CurrentUser }) {
  const [workouts, setWorkouts] = useState<ListItem[] | null>(null);
  const [stats, setStats] = useState<Map<string, WorkoutStats>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const region = useUserRegion();
  const sites = useLoad(region ? () => loadSites(region) : null, [region?.id]);

  useEffect(() => {
    loadPublicWorkouts()
      .then(async (list) => {
        setStats(await loadWorkoutStats(list.map((w) => w.id)));
        setWorkouts(list);
      })
      .catch((e: Error) => setError(e.message));
  }, [user.id]);

  const groups = useMemo(() => {
    if (!workouts) return [];
    const statsOf = (w: ListItem) => stats.get(w.id) ?? NO_STATS;
    const aos = new Set(
      (sites.value ?? []).map((site) => site.name.toLowerCase()),
    );
    return [
      {
        title: "Most liked",
        items: workouts
          .filter((w) => statsOf(w).likes > 0)
          .sort((a, b) => statsOf(b).likes - statsOf(a).likes),
      },
      {
        title: "Most reused",
        items: workouts
          .filter((w) => statsOf(w).reuses > 0)
          .sort((a, b) => statsOf(b).reuses - statsOf(a).reuses),
      },
      {
        title: region ? `At ${region.name} AOs` : "",
        items: aos.size
          ? workouts.filter((w) => aos.has(w.ao.trim().toLowerCase()))
          : [],
      },
      { title: "Newest", items: workouts },
    ]
      .filter((group) => group.title && group.items.length > 0)
      .map((group) => ({ ...group, items: group.items.slice(0, PER_GROUP) }));
    // Sorting reads `stats`, which changes as people like things; keep the order stable by only
    // regrouping when the list itself loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, sites.value, region?.name]);

  return (
    <section className="card">
      <header className="flex flex-col gap-1">
        <h1 className="card-title">Discover</h1>
        <p className="text-sm text-muted">
          Public workouts from every Q. Like the ones you enjoy, and Reuse one
          to run it yourself.
        </p>
      </header>
      {error ? (
        <p className="panel px-3 py-8 text-center text-accent">{error}</p>
      ) : !workouts ? (
        <p className="panel px-3 py-8 text-center text-muted">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="panel px-3 py-8 text-center text-muted">
          No public workouts yet.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-2">
            <h2 className="px-1 text-lg font-semibold tracking-tight text-ink">
              {group.title}
            </h2>
            <ul className="panel flex flex-col divide-y divide-line p-2">
              {group.items.map((workout) => (
                <li key={workout.id}>
                  <Link
                    href={`/workout?id=${workout.id}`}
                    className="flex flex-col gap-1.5 rounded-xl px-3 py-3 transition-colors hover:bg-hover"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium text-ink">
                        {workout.title || "Untitled workout"}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-ink-soft">
                        {workout.date}
                      </span>
                    </span>
                    <span className="truncate text-sm text-muted">
                      {[workout.ao, workout.author?.name]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <WorkoutStatsBar
                      compact
                      workoutId={workout.id}
                      stats={stats.get(workout.id) ?? NO_STATS}
                      canLike={workout.author_id !== user.id}
                      onChange={(next) =>
                        setStats((current) =>
                          new Map(current).set(workout.id, next),
                        )
                      }
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
