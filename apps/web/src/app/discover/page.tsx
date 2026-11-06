"use client";

import type { Language } from "@rocket/core";
import { useEffect, useMemo, useState } from "react";
import {
  ALL_PUBLIC_SOURCES,
  SignedIn,
  type CurrentUser,
} from "@/components/auth-provider";
import { SourceChips } from "@/components/source-chips";
import { WorkoutCards } from "@/components/workout-card";
import type { ListItem } from "@/lib/backblast-list";
import { loadPublicWorkouts, trending } from "@/lib/discover";
import { loadSites, type Region } from "@/lib/regions";
import { createClient } from "@/lib/supabase/client";
import { useLoad, useRegionScope } from "@/lib/use-region";
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
  // Your own workouts are left out unless you include them; the choice is saved to your account.
  const [includeOwn, setIncludeOwn] = useState(user.discoverIncludeOwn);
  // Which organizations' workouts show (F3, FiA or both), saved to your account.
  const [chosen, setChosen] = useState<Language[]>(user.publicSources);
  // Your region, or every region of your organization: each gets its own "At … AOs" group.
  const scope = useRegionScope();
  // Compared as text, so a new array with the same choices doesn't reload.
  const sources = chosen.join();

  function chooseSources(off: string[]) {
    const next = ALL_PUBLIC_SOURCES.filter((s) => !off.includes(s));
    setChosen(next);
    createClient()
      .auth.updateUser({ data: { public_sources: next } })
      .then(() => {});
  }

  function chooseIncludeOwn(on: boolean) {
    setIncludeOwn(on);
    createClient()
      .auth.updateUser({ data: { discover_include_own: on } })
      .then(() => {});
  }
  const regionAos = useLoad(
    scope
      ? () =>
          Promise.all(
            scope.regions.map(async (region) => ({
              region,
              aos: new Set(
                (await loadSites(region).catch(() => [])).map((s) =>
                  s.name.toLowerCase(),
                ),
              ),
            })),
          )
      : null,
    [scope?.regions.map((r) => r.id).join() ?? ""],
  );

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
    // One group per region, for the workouts at its AOs.
    const atRegions = (regionAos.value ?? []).map(
      ({ region, aos }: { region: Region; aos: Set<string> }) => ({
        title: `At ${region.name} AOs`,
        items: shown.filter((w) => aos.has(w.ao.trim().toLowerCase())),
      }),
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
      ...atRegions,
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
  }, [workouts, regionAos.value, includeOwn, user.id]);

  return (
    <section className="card">
      <header className="flex flex-col gap-1">
        <h1 className="card-title">Discover</h1>
        <p className="text-sm text-muted">
          Public workouts from other Qs. Like the ones you enjoy, and Reuse one
          to run it yourself.
        </p>
      </header>
      <div className="flex flex-col gap-3">
        <SourceChips
          chips={[
            { key: "f3", label: "F3", color: "var(--badge-f3)" },
            { key: "fia", label: "FiA", color: "var(--badge-fia)" },
          ]}
          off={ALL_PUBLIC_SOURCES.filter((s) => !chosen.includes(s))}
          onChange={chooseSources}
        />
        <label className="flex items-center gap-2 self-start text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={includeOwn}
            onChange={(e) => chooseIncludeOwn(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Include my workouts
        </label>
      </div>
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
