"use client";

import { attendeeFromName } from "@rocket/core";
import { useState } from "react";

/** The menu's choice for typing a name that isn't on the roster. */
const OTHER = "__other";

/**
 * The beatdown's Qs, each picked from the region's roster. "Add a Q" adds another for a co-Q.
 * Without a roster, each Q is typed in.
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
  // Rows being typed by hand, by index.
  const [typing, setTyping] = useState<Set<number>>(new Set());
  // Roster names without notes like "(Seattle)", since a Q is listed by name alone.
  const names = [
    ...new Set((roster ?? []).map((name) => attendeeFromName(name).name)),
  ].sort((a, b) => a.localeCompare(b));
  const rows = value.length > 0 ? value : [""];

  const update = (index: number, name: string) =>
    onChange(rows.map((q, i) => (i === index ? name : q)));

  function setTypingRow(index: number, on: boolean) {
    setTyping((current) => {
      const next = new Set(current);
      if (on) next.add(index);
      else next.delete(index);
      return next;
    });
  }

  function remove(index: number) {
    onChange(rows.filter((_, i) => i !== index));
    // Rows after the removed one move up.
    setTyping(
      (current) =>
        new Set(
          [...current]
            .filter((i) => i !== index)
            .map((i) => (i > index ? i - 1 : i)),
        ),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="label">{rows.length > 1 ? "Qs" : "Q"}</span>
      <ul className="flex flex-col gap-2">
        {rows.map((q, index) => {
          // Match the roster however the name was typed, e.g. "sparky" or "Sparky (2.0)".
          const plain = attendeeFromName(q).name.trim().toLowerCase();
          const listed = names.find((name) => name.toLowerCase() === plain);
          const typed =
            names.length === 0 || typing.has(index) || (q !== "" && !listed);
          return (
            <li key={index} className="flex gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {names.length > 0 && (
                  <select
                    aria-label={`Q ${index + 1}`}
                    value={typed ? OTHER : (listed ?? "")}
                    onChange={(e) => {
                      const other = e.target.value === OTHER;
                      setTypingRow(index, other);
                      update(index, other ? "" : e.target.value);
                    }}
                    className="input text-base"
                  >
                    <option value="">Choose the Q…</option>
                    {names.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                    <option value={OTHER}>Other…</option>
                  </select>
                )}
                {typed && (
                  <input
                    aria-label={names.length > 0 ? "Q name" : `Q ${index + 1}`}
                    placeholder="Q name"
                    value={q}
                    onChange={(e) => update(index, e.target.value)}
                    className="input text-base"
                  />
                )}
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove ${q || "Q"}`}
                  onClick={() => remove(index)}
                  className="link shrink-0 self-start px-2 py-2.5 text-lg"
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...rows, ""])}
        className="link self-start py-1"
      >
        <span className="text-accent">＋</span> Add a Q
      </button>
    </div>
  );
}
