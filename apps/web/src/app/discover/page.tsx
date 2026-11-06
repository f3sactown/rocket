"use client";

import type { Language } from "@rocket/core";
import { useEffect, useMemo, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { WorkoutCards } from "@/components/workout-card";
import type { ListItem } from "@/lib/backblast-list";
import { loadPublicWorkouts, trending } from "@/lib/discover";
import { loadSites } from "@/lib/regions";
import { createClient } from "@/lib/supabase/client";
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
  // Your own workouts are left out unless you include them (asked once here, or in Settings).
  const includeOwn = user.discoverIncludeOwn;
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
    const shown = includeOwn
      ? workouts
      : workouts.filter((w) => w.author_id !== user.id);
    const statsOf = (w: ListItem) => stats.get(w.id) ?? NO_STATS;
    const aos = new Set(
      (sites.value ?? []).map((site) => site.name.toLowerCase()),
    );
    // Your own, best first, to compare how they're doing.
    const mine = includeOwn
      ? workouts
          .filter((w) => w.author_id === user.id)
          .sort(
            (a, b) =>
              statsOf(b).likes - statsOf(a).likes ||
              statsOf(b).reuses - statsOf(a).reuses,
          )
      : [];
    return [
      { title: "My workouts", items: mine, all: true },
      { title: "Trending", items: trending(shown, stats) },
      {
        title: "Most liked",
        items: shown
          .filter((w) => statsOf(w).likes > 0)
          .sort((a, b) => statsOf(b).likes - statsOf(a).likes),
      },
      {
        title: "Most reused",
        items: shown
          .filter((w) => statsOf(w).reuses > 0)
          .sort((a, b) => statsOf(b).reuses - statsOf(a).reuses),
      },
      {
        title: region ? `At ${region.name} AOs` : "",
        items: aos.size
          ? shown.filter((w) => aos.has(w.ao.trim().toLowerCase()))
          : [],
      },
      { title: "Newest", items: shown },
    ]
      .filter((group) => group.title && group.items.length > 0)
      .map((group) => ({
        ...group,
        items: "all" in group ? group.items : group.items.slice(0, PER_GROUP),
      }));
    // Sorting reads `stats`, which changes as people like things; keep the order stable by only
    // regrouping when the list itself loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, sites.value, region?.name, includeOwn, user.id]);

  return (
    <section className="card">
      <header className="flex flex-col gap-1">
        <h1 className="card-title">Discover</h1>
        <p className="text-sm text-muted">
          Public workouts from other Qs. Like the ones you enjoy, and Reuse one
          to run it yourself.
        </p>
      </header>
      {!user.discoverOwnAsked && <IncludeOwnPrompt />}
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
              tiles
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

/**
 * Asks once, without getting in the way, whether Discover should include your own workouts.
 * Either answer is saved to your account (and can be changed in Settings → Public workouts).
 */
function IncludeOwnPrompt() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function answer(include: boolean) {
    setSaving(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({
      data: { discover_include_own: include, discover_own_asked: true },
    });
    if (error) {
      setError(error.message);
      setSaving(false);
    }
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3"
    >
      <p className="text-sm text-ink">
        Want your own public workouts on Discover too? You&apos;d get a{" "}
        <span className="font-medium">My workouts</span> section to see how they
        compare. You can change this later in Settings.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => answer(true)}
          className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Include mine
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => answer(false)}
          className="link text-sm"
        >
          No thanks
        </button>
        {error && <span className="text-sm text-accent">{error}</span>}
      </div>
    </div>
  );
}
