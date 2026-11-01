"use client";

import {
  attendance,
  attendeeLabel,
  type Attendee,
  type Backblast,
} from "@rocket/core";
import { useState } from "react";

interface Count {
  label: string;
  people: string[];
}

/** Everyone counted in each total, labelled as on the backblast (Q, home region, inviter, 2.0). */
function countsFor(backblast: Backblast): Count[] {
  const q = backblast.q.trim().toLowerCase();
  const label = (attendee: Attendee) =>
    q && attendee.name.trim().toLowerCase() === q
      ? `${attendeeLabel(attendee)} (Q)`
      : attendeeLabel(attendee);
  const everyone = attendance(backblast);
  const ofKind = (kind: Attendee["kind"]) =>
    everyone.filter((attendee) => attendee.kind === kind).map(label);
  return [
    { label: "PAX", people: everyone.map(label) },
    { label: "FNGs", people: ofKind("fng") },
    { label: "Downrange", people: ofKind("visitor") },
  ];
}

/** The PAX / FNGs / Downrange totals. Hover or tap one to see who's in it. */
export function CountPanel({ backblast }: { backblast: Backblast }) {
  const counts = countsFor(backblast);
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const shown = counts.find((count) => count.label === (hovered ?? pinned));

  return (
    <div className="flex flex-col gap-2">
      <div className="panel grid grid-cols-3 divide-x divide-line p-0">
        {counts.map((count) => {
          const active = shown?.label === count.label;
          return (
            <button
              key={count.label}
              type="button"
              aria-expanded={active}
              aria-controls="count-people"
              onClick={() =>
                setPinned(pinned === count.label ? null : count.label)
              }
              // Hover previews on devices with a mouse; taps pin the list open.
              onPointerEnter={(e) =>
                e.pointerType === "mouse" && setHovered(count.label)
              }
              onPointerLeave={(e) =>
                e.pointerType === "mouse" && setHovered(null)
              }
              className={`flex flex-col items-center gap-2 py-5 transition-colors first:rounded-l-[inherit] last:rounded-r-[inherit] ${
                active ? "bg-hover" : "hover:bg-hover"
              }`}
            >
              <span
                className={`font-mono text-2xl ${active ? "text-accent" : "text-ink"}`}
              >
                {count.people.length}
              </span>
              <span className="text-sm text-ink-soft">{count.label}</span>
            </button>
          );
        })}
      </div>
      {shown && (
        <div
          id="count-people"
          role="region"
          aria-label={`${shown.label} at this beatdown`}
          className="rounded-2xl border border-line bg-surface p-3"
        >
          <p className="mb-2 text-xs font-semibold tracking-wider text-accent uppercase">
            {shown.label} ({shown.people.length})
          </p>
          {shown.people.length === 0 ? (
            <p className="text-sm text-muted">None at this beatdown.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {shown.people.map((person) => (
                <li
                  key={person}
                  className="rounded-full border border-line px-3 py-1 text-sm text-ink-soft"
                >
                  {person}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
