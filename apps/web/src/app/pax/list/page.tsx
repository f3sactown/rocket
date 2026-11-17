"use client";

import type { Language } from "@rocket/core";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { BackblastList } from "@/components/backblast-list";
import { WorkoutCards } from "@/components/workout-card";
import { loadPaxWorkouts } from "@/lib/pax";
import { useLoad } from "@/lib/use-region";
import type { WorkoutStats } from "@/lib/workout-social";

export default function PaxListPage() {
  return (
    <SignedIn>
      {(user) => (
        <Suspense fallback={<div className="card h-96 animate-pulse" />}>
          <PaxList user={user} />
        </Suspense>
      )}
    </SignedIn>
  );
}

/**
 * Every public workout (?kind=workouts) or backblast (?kind=backblasts) of one PAX, newest first:
 * the full list behind "See all" on their profile.
 */
function PaxList({ user }: { user: CurrentUser }) {
  const params = useSearchParams();
  const name = params.get("name") ?? "";
  const org: Language = params.get("org") === "fia" ? "fia" : "f3";
  const kind = params.get("kind") === "backblasts" ? "backblasts" : "workouts";
  const data = useLoad(name ? () => loadPaxWorkouts(name, org) : null, [
    name,
    org,
  ]);
  const [statsOverride, setStatsOverride] = useState<Map<string, WorkoutStats>>(
    new Map(),
  );
  const stats = useMemo(
    () => new Map([...(data.value?.stats ?? []), ...statsOverride]),
    [data.value, statsOverride],
  );
  const items = data.value?.[kind] ?? [];
  const profile = `/pax/profile?name=${encodeURIComponent(name)}&org=${org}`;

  return (
    <section className="card">
      <header className="flex flex-col gap-1">
        <Link href={profile} className="link self-start text-sm">
          ← {name}
        </Link>
        <h1 className="card-title">
          {name}&apos;s {kind}
          {data.value && (
            <span className="ml-2 text-base font-normal text-muted">
              {items.length}
            </span>
          )}
        </h1>
        <p className="text-sm text-ink-soft">
          Every public one, the most recent first.
        </p>
      </header>
      {data.error ? (
        <p className="text-sm text-accent">{data.error}</p>
      ) : !data.value ? (
        <p className="panel px-3 py-8 text-center text-muted">Loading…</p>
      ) : !items.length ? (
        <p className="panel px-3 py-8 text-center text-muted">
          No public {kind} yet.
        </p>
      ) : kind === "workouts" ? (
        <WorkoutCards
          workouts={items}
          stats={stats}
          userId={user.id}
          onStatsChange={(id, next) =>
            setStatsOverride((m) => new Map(m).set(id, next))
          }
        />
      ) : (
        <BackblastList user={user} groups={[{ items }]} />
      )}
    </section>
  );
}
