"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { Highlight } from "@/components/highlight";
import { HeartIcon, ReuseIcon } from "@/components/icons";
import { SourceChips } from "@/components/source-chips";
import { loadAllPax } from "@/lib/pax";
import { regionColors } from "@/lib/regions";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/use-region";

export default function PaxPage() {
  return <SignedIn>{(user) => <Pax user={user} />}</SignedIn>;
}

/** How many tiles show before "Show more". */
const PAGE = 60;

/**
 * Every PAX on the regions' rosters, in alphabetical order, searchable by name, as tiles with
 * their regions, posts and Qs; tap one for their profile. The From picker (which regions) is saved
 * to the account.
 */
function Pax({ user }: { user: CurrentUser }) {
  const data = useLoad(loadAllPax, []);
  const [query, setQuery] = useState("");
  const [off, setOff] = useState(user.paxSourcesOff);
  const [shown, setShown] = useState(PAGE);
  const colors = useMemo(
    () => regionColors(data.value?.regions ?? []),
    [data.value],
  );

  // Saved to the account, so the same regions are chosen next time.
  function choose(next: string[]) {
    setOff(next);
    setShown(PAGE);
    createClient()
      .auth.updateUser({ data: { pax_sources_off: next } })
      .then(() => {});
  }

  const words = useMemo(
    () => query.toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  );
  const results = useMemo(
    () =>
      (data.value?.pax ?? [])
        .map((p) => {
          // Only the chosen regions count, for badges and totals.
          const regions = p.regions.filter((r) => !off.includes(r.id));
          return {
            ...p,
            regions,
            posts: regions.reduce((n, r) => n + r.posts, 0),
            qs: regions.reduce((n, r) => n + r.qs, 0),
          };
        })
        .filter(
          (p) =>
            p.regions.length > 0 &&
            words.every((w) => p.name.toLowerCase().includes(w)),
        ),
    [data.value, off, words],
  );

  return (
    <section className="card">
      <header className="flex flex-col gap-1">
        <h1 className="card-title">PAX</h1>
        <p className="text-sm text-muted">
          Everyone on your regions&apos; rosters, A to Z. Search by name, and
          tap one for their profile.
        </p>
      </header>
      <div className="flex flex-col gap-3">
        <input
          type="search"
          aria-label="Search PAX by name"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          className="input text-base"
        />
        {data.value && data.value.regions.length > 0 && (
          <SourceChips
            chips={data.value.regions.map((r) => ({
              key: r.id,
              label: r.name,
              color: colors.get(r.id) ?? "var(--badge-region)",
            }))}
            off={off}
            onChange={choose}
          />
        )}
      </div>

      {data.error ? (
        <p className="panel px-3 py-8 text-center text-accent">{data.error}</p>
      ) : !data.value ? (
        <p className="panel px-3 py-8 text-center text-muted">Loading…</p>
      ) : results.length === 0 ? (
        <p className="panel px-3 py-8 text-center text-muted">
          {query ? `No PAX match “${query}”.` : "No PAX on these rosters yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="px-1 text-xs text-muted">{results.length} PAX</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {results.slice(0, shown).map((p) => (
              <li key={p.name} className="min-w-0">
                <Link
                  href={`/pax/profile?name=${encodeURIComponent(p.name)}`}
                  className="panel flex h-full flex-col gap-2 p-3 transition-colors hover:border-accent/40"
                >
                  <span className="font-medium break-words text-ink">
                    <Highlight text={p.name} words={words} />
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {p.regions.map((r) => (
                      <span
                        key={r.id}
                        className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold tracking-wide"
                        style={{
                          background: colors.get(r.id) ?? "var(--badge-region)",
                          color: "var(--badge-text)",
                        }}
                      >
                        {r.name}
                      </span>
                    ))}
                  </span>
                  <span className="mt-auto flex flex-col gap-1 pt-1 text-xs text-ink-soft">
                    <span className="flex gap-3">
                      {(
                        [
                          [p.posts, "posts"],
                          [p.qs, "Qs"],
                        ] as const
                      ).map(([value, label]) => (
                        <span key={label}>
                          <span className="mr-1 font-mono text-sm text-ink tabular-nums">
                            {value}
                          </span>
                          {label}
                        </span>
                      ))}
                    </span>
                    {/* Likes and reuses as on workout tiles: heart and reuse icons with the counts. */}
                    <span className="flex items-center gap-4">
                      <span
                        className="inline-flex items-center gap-1.5"
                        title={`${p.likes} ${p.likes === 1 ? "like" : "likes"}`}
                      >
                        <span className="text-accent">
                          <HeartIcon filled={p.likes > 0} />
                        </span>
                        {p.likes}
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5"
                        title={`${p.reuses} ${p.reuses === 1 ? "reuse" : "reuses"}`}
                      >
                        <span className="text-accent">
                          <ReuseIcon />
                        </span>
                        {p.reuses}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {results.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="link self-center py-2 text-sm"
            >
              Show more ({results.length - shown} left)
            </button>
          )}
        </div>
      )}
    </section>
  );
}
