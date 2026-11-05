"use client";

import type { Language } from "@rocket/core";
import { useEffect, useMemo, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { WorkoutCards } from "@/components/workout-card";
import type { ListItem } from "@/lib/backblast-list";
import { loadPublicWorkouts, trending } from "@/lib/discover";
import { loadSites } from "@/lib/regions";
import { useLoad, useUserRegion } from "@/lib/use-region";
import { NO_STATS, type WorkoutStats } from "@/lib/workout-social";

export default function DiscoverPage() {
  return <SignedIn>{(user) => <Discover user={user} />}</SignedIn>;
}

/** How many workouts each group shows. */
const PER_GROUP = 8;

/**
 * Public workouts to browse, in groups: trending, most liked, most reused, at your region's AOs,
 * and newest.
 * Like someone else's straight from the list.
 */
function Discover({ user }: { user: CurrentUser }) {
  const [workouts, setWorkouts] = useState<ListItem[] | null>(null);
  const [stats, setStats] = useState<Map<string, WorkoutStats>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const region = useUserRegion();
  // Compared as text, since each sign-in refresh brings a new array.
  const sources = user.publicSources.join();
  const sites = useLoad(region ? () => loadSites(region) : null, [region?.id]);

  useEffect(() => {
    loadPublicWorkouts(sources.split(",") as Language[]).then(
      (loaded) => {
        setStats(loaded.stats);
        setWorkouts(loaded.workouts);
      },
      (e: Error) => setError(e.message),
    );
  }, [user.id, sources]);

  const groups = useMemo(() => {
    if (!workouts) return [];
    const statsOf = (w: ListItem) => stats.get(w.id) ?? NO_STATS;
    const aos = new Set(
      (sites.value ?? []).map((site) => site.name.toLowerCase()),
    );
    return [
      { title: "Trending", items: trending(workouts, stats) },
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
            <WorkoutCards
              workouts={group.items}
              stats={stats}
              userId={user.id}
              onStatsChange={(id, next) =>
                setStats((current) => new Map(current).set(id, next))
              }
            />
          </div>
        ))
      )}
    </section>
  );
}
