"use client";

import { attendeeFromName, type Attendee } from "@rocket/core";
import { loadRegulars, REGULARS_MONTHS, type Region } from "@/lib/regions";
import { useLoad } from "@/lib/use-region";

/**
 * PAX who've posted at the AO recently, most posts first, as chips to add with a tap.
 * Anyone already listed (or the Q) is left out.
 */
export function Regulars({
  region,
  ao,
  qs,
  attendees,
  onAdd,
}: {
  region: Region;
  ao: string;
  /** The Qs, left out like anyone already listed. */
  qs: string[];
  attendees: Attendee[];
  onAdd: (names: string[]) => void;
}) {
  const aoName = ao.trim();
  const regulars = useLoad(aoName ? () => loadRegulars(region, aoName) : null, [
    region.id,
    aoName.toLowerCase(),
  ]);
  if (!aoName) return null;

  const listed = new Set(
    [...qs, ...attendees.map((a) => a.name)].map((n) => n.trim().toLowerCase()),
  );
  const available = (regulars.value ?? []).filter(
    (r) => !listed.has(attendeeFromName(r.name).name.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink-soft">
          Regulars at {aoName}
          <span className="font-normal text-muted">
            {" "}
            · last {REGULARS_MONTHS} months
          </span>
        </span>
        {available.length > 1 && (
          <button
            type="button"
            onClick={() => onAdd(available.map((r) => r.name))}
            className="link shrink-0 text-xs"
          >
            Add all
          </button>
        )}
      </div>
      {regulars.loading && <p className="text-sm text-muted">Loading…</p>}
      {regulars.error && (
        <p className="text-sm text-accent">{regulars.error}</p>
      )}
      {regulars.value &&
        (available.length === 0 ? (
          <p className="text-sm text-muted">
            {regulars.value.length === 0
              ? "No posts recorded here recently."
              : "Everyone's already added."}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {available.map((r) => (
              <li key={r.name}>
                <button
                  type="button"
                  onClick={() => onAdd([r.name])}
                  title={`${r.posts} posts here in the last ${REGULARS_MONTHS} months`}
                  className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm text-ink-soft transition-colors hover:border-accent/60 hover:text-ink"
                >
                  <span className="text-accent">＋</span>
                  {r.name}
                  <span className="font-mono text-xs text-muted">
                    {r.posts}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
