"use client";

import type { Attendee, AttendeeKind } from "@rocket/core";
import { useRef } from "react";

const KIND_LABELS: Record<AttendeeKind, string> = {
  pax: "PAX",
  visitor: "Downrange",
  fng: "FNG",
  "2.0": "2.0",
};

/** Editable list of everyone who posted, with the extra detail each kind needs. */
export function AttendanceInput({
  value,
  onChange,
}: {
  value: Attendee[];
  onChange: (attendees: Attendee[]) => void;
}) {
  const list = useRef<HTMLUListElement>(null);

  function update(index: number, patch: Partial<Attendee>) {
    onChange(
      value.map((attendee, i) =>
        i === index ? { ...attendee, ...patch } : attendee,
      ),
    );
  }

  function add() {
    onChange([...value, { name: "", kind: "pax" }]);
    // Focus the new row's name once it renders.
    requestAnimationFrame(() =>
      list.current
        ?.querySelector<HTMLInputElement>("li:last-child input")
        ?.focus(),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul ref={list} className="flex flex-col gap-2">
        {value.map((attendee, index) => (
          <li
            key={index}
            className="grid grid-cols-[1fr_7rem_auto] gap-2 sm:flex"
          >
            <input
              aria-label="Name"
              placeholder="F3 name"
              value={attendee.name}
              onChange={(e) => update(index, { name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (index === value.length - 1) add();
                }
              }}
              className="input min-w-0 flex-1"
            />
            <select
              aria-label="Type"
              value={attendee.kind}
              onChange={(e) =>
                update(index, { kind: e.target.value as AttendeeKind })
              }
              className="input shrink-0 sm:w-28"
            >
              {Object.entries(KIND_LABELS).map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </select>
            {attendee.kind === "visitor" && (
              <Detail
                label="from"
                ariaLabel="Home region"
                placeholder="Home region"
                value={attendee.region ?? ""}
                onChange={(region) => update(index, { region })}
              />
            )}
            {attendee.kind === "fng" && (
              <Detail
                label="invited by"
                ariaLabel="Invited by"
                placeholder="PAX name"
                value={attendee.invitedBy ?? ""}
                onChange={(invitedBy) => update(index, { invitedBy })}
              />
            )}
            <button
              type="button"
              aria-label={`Remove ${attendee.name || "row"}`}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              className="link col-start-3 row-start-1 shrink-0 px-2 text-lg"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={add} className="link self-start py-1">
        <span className="text-accent">＋</span> Add PAX
      </button>
    </div>
  );
}

/** The extra detail a downrange PAX or FNG needs, with an inline label so it isn't mistaken for a name. */
function Detail({
  label,
  ariaLabel,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="input col-span-2 row-start-2 flex min-w-0 flex-1 items-center gap-2 focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent-soft">
      <span className="shrink-0 text-sm text-muted">{label}</span>
      <input
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
      />
    </label>
  );
}
