"use client";

import { attendeeFromName } from "@rocket/core";
import { useRef } from "react";

/**
 * The beatdown's Qs, typed like PAX names with matches from the region's roster suggested.
 * "Add a Q" adds another for a co-Q.
 */
export function QPicker({
  value,
  onChange,
  roster,
}: {
  value: string[];
  onChange: (qs: string[]) => void;
  roster?: string[];
}) {
  const list = useRef<HTMLUListElement>(null);
  const rows = value.length > 0 ? value : [""];

  /** Picking a roster name like "Cubby (2.0)" keeps just the name. */
  const update = (index: number, typed: string) => {
    const name = roster?.includes(typed) ? attendeeFromName(typed).name : typed;
    onChange(rows.map((q, i) => (i === index ? name : q)));
  };

  function add() {
    onChange([...rows, ""]);
    // Focus the new row once it renders.
    requestAnimationFrame(() =>
      list.current
        ?.querySelector<HTMLInputElement>("li:last-child input")
        ?.focus(),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="label">{rows.length > 1 ? "Qs" : "Q"}</span>
      <ul ref={list} className="flex flex-col gap-2">
        {rows.map((q, index) => (
          <li key={index} className="flex gap-2">
            <input
              aria-label={`Q ${index + 1}`}
              list={roster ? "q-roster-names" : undefined}
              placeholder="Q name"
              value={q}
              onChange={(e) => update(index, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (index === rows.length - 1) add();
                }
              }}
              className="input min-w-0 flex-1 text-base"
            />
            {rows.length > 1 && (
              <button
                type="button"
                aria-label={`Remove ${q || "Q"}`}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                className="link shrink-0 px-2 text-lg"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {roster && (
        <datalist id="q-roster-names">
          {roster.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}
      <button type="button" onClick={add} className="link self-start py-1">
        <span className="text-accent">＋</span> Add a Q
      </button>
    </div>
  );
}
