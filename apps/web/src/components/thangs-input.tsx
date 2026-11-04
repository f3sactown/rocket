"use client";

import { formatTimer, type Thang } from "@rocket/core";
import { useState } from "react";

/** Reads a timer typed as minutes ("5"), m:ss ("4:30") or blank (no timer). */
export function parseTimer(value: string): number | undefined | null {
  const text = value.trim();
  if (!text) return undefined;
  const match = /^(\d{1,3})(?::(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const seconds = Number(match[1]) * 60 + Number(match[2] ?? 0);
  return seconds > 0 ? seconds : undefined;
}

/**
 * The workout's thangs: a box for each, an optional timer for the Run workout screen, and a
 * button to add another.
 */
export function ThangsInput({
  value,
  onChange,
  placeholder,
}: {
  value: Thang[];
  onChange: (thangs: Thang[]) => void;
  placeholder: string;
}) {
  const rows = value.length > 0 ? value : [{ text: "" }];
  const update = (index: number, patch: Partial<Thang>) =>
    onChange(rows.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  return (
    <div className="flex flex-1 flex-col gap-4">
      {rows.map((thang, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-xl border border-line p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">
              {rows.length > 1 ? `Thang ${index + 1}` : "Thang"}
            </span>
            {rows.length > 1 && (
              <button
                type="button"
                aria-label={`Remove thang ${index + 1}`}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                className="link px-2 text-lg"
              >
                ×
              </button>
            )}
          </div>
          <textarea
            aria-label={rows.length > 1 ? `Thang ${index + 1}` : "The Thang"}
            placeholder={placeholder}
            value={thang.text}
            onChange={(e) => update(index, { text: e.target.value })}
            className="input min-h-36 resize-y text-base leading-relaxed"
          />
          <TimerField
            key={`${index}-${thang.seconds ?? ""}`}
            seconds={thang.seconds}
            onChange={(seconds) => update(index, { seconds })}
            label={`Timer for thang ${index + 1}`}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { text: "" }])}
        className="link self-start py-1"
      >
        <span className="text-accent">＋</span> Add another thang
      </button>
    </div>
  );
}

/** A timer typed as minutes or m:ss, saved once it reads as a time. */
function TimerField({
  seconds,
  onChange,
  label,
}: {
  seconds?: number;
  onChange: (seconds: number | undefined) => void;
  label: string;
}) {
  const [text, setText] = useState(seconds ? formatTimer(seconds) : "");
  const parsed = parseTimer(text);
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
      <span className="shrink-0">Timer</span>
      <input
        aria-label={label}
        inputMode="numeric"
        placeholder="none"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const next = parseTimer(e.target.value);
          if (next !== null) onChange(next);
        }}
        onBlur={() => {
          if (parsed) setText(formatTimer(parsed));
        }}
        className="input w-24 py-1.5 text-base"
      />
      <span className="text-xs text-muted">
        {parsed === null
          ? "Use minutes, like 5, or m:ss, like 4:30"
          : "minutes, or m:ss"}
      </span>
    </label>
  );
}
