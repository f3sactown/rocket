"use client";

import { LANGUAGES, type Language } from "@rocket/core";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { WorkoutCards } from "@/components/workout-card";
import { loadAllPax, loadPaxWorkouts } from "@/lib/pax";
import { regionColors } from "@/lib/regions";
import { useLoad } from "@/lib/use-region";
import type { WorkoutStats } from "@/lib/workout-social";

export default function PaxProfilePage() {
  return (
    <SignedIn>
      {(user) => (
        <Suspense fallback={<div className="card h-96 animate-pulse" />}>
          <PaxProfile user={user} />
        </Suspense>
      )}
    </SignedIn>
  );
}

/**
 * One PAX: their regions with posts and Qs in each, and, from the Rocket account with the same
 * name, their recent public workouts and the ones trending lately.
 */
function PaxProfile({ user }: { user: CurrentUser }) {
  const params = useSearchParams();
  const name = params.get("name") ?? "";
  // The same name in F3 and FiA is two different PAX.
  const org: Language = params.get("org") === "fia" ? "fia" : "f3";
  const all = useLoad(loadAllPax, []);
  const workouts = useLoad(name ? () => loadPaxWorkouts(name, org) : null, [
    name,
    org,
  ]);
  const [statsOverride, setStatsOverride] = useState<Map<string, WorkoutStats>>(
    new Map(),
  );
  const entry = all.value?.pax.find(
    (p) => p.org === org && p.name.toLowerCase() === name.trim().toLowerCase(),
  );
  const colors = useMemo(
    () => regionColors(all.value?.regions ?? []),
    [all.value],
  );
  const stats = useMemo(
    () => new Map([...(workouts.value?.stats ?? []), ...statsOverride]),
    [workouts.value, statsOverride],
  );
  const onStatsChange = (id: string, next: WorkoutStats) =>
    setStatsOverride((m) => new Map(m).set(id, next));

  return (
    <article className="card">
      <Link href="/pax" className="link -mb-2 self-start text-sm">
        ← PAX
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="card-title break-words">{name || "PAX"}</h1>
        {name && (
          <p className="text-sm text-muted">
            {LANGUAGES.find((l) => l.value === org)?.label}
          </p>
        )}
      </header>

      {all.value && !entry && (
        <p className="panel px-3 py-6 text-center text-muted">
          {name
            ? `${name} isn’t on any ${LANGUAGES.find((l) => l.value === org)?.label} region’s roster.`
            : "No PAX chosen."}
        </p>
      )}
      {entry && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-4 gap-2">
            {[
              ["Posts", entry.posts],
              ["Qs", entry.qs],
              ["Likes", entry.likes],
              ["Reuses", entry.reuses],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex min-w-0 flex-col items-center gap-0.5 rounded-2xl border py-3"
                style={{ borderColor: "var(--accent)" }}
              >
                <span className="font-mono text-2xl text-ink tabular-nums">
                  {value}
                </span>
                <span className="text-xs text-ink-soft">{label}</span>
              </div>
            ))}
          </div>
          <ul className="flex flex-col gap-2">
            {entry.regions.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span
                  className="rounded-full px-2 py-0.5 text-[0.7rem] font-bold tracking-wide"
                  style={{
                    background: colors.get(r.id) ?? "var(--badge-region)",
                    color: "var(--badge-text)",
                  }}
                >
                  {r.name}
                </span>
                <span className="font-mono text-ink-soft tabular-nums">
                  {r.posts} posts · {r.qs} Qs
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {workouts.error ? (
        <p className="text-sm text-accent">{workouts.error}</p>
      ) : !workouts.value ? (
        name && (
          <p className="panel px-3 py-8 text-center text-muted">Loading…</p>
        )
      ) : !workouts.value.hasAccount ? (
        <p className="text-sm text-muted">
          {name} doesn&apos;t have workouts on Rocket yet.
        </p>
      ) : (
        <>
          <Group title="Trending workouts">
            {workouts.value.trending.length ? (
              <WorkoutCards
                tiles
                workouts={workouts.value.trending}
                stats={stats}
                userId={user.id}
                onStatsChange={onStatsChange}
              />
            ) : (
              <p className="text-sm text-muted">Nothing trending lately.</p>
            )}
          </Group>
          <Group title="Recent workouts">
            {workouts.value.recent.length ? (
              <WorkoutCards
                tiles
                workouts={workouts.value.recent}
                stats={stats}
                userId={user.id}
                onStatsChange={onStatsChange}
              />
            ) : (
              <p className="text-sm text-muted">No public workouts yet.</p>
            )}
          </Group>
        </>
      )}
    </article>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="px-1 text-lg font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {children}
    </div>
  );
}
