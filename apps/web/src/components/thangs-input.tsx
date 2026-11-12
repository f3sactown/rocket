"use client";

import {
  TIMER_TYPES,
  formatTimer,
  newTimer,
  timerLabel,
  type Thang,
  type Timer,
} from "@rocket/core";
import { useState } from "react";
import { LibraryButton } from "./library-picker";

/** Reads a time typed as minutes ("5") or m:ss ("4:30"); null if it isn't one. */
export function parseTime(value: string): number | null {
  const match = /^(\d{1,3})(?::(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const seconds = Number(match[1]) * 60 + Number(match[2] ?? 0);
  return seconds > 0 ? seconds : null;
}

/**
 * The workout's thangs: a box for each, a "＋ Add timer" below each for the Run workout screen,
 * and a button to add another thang.
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
          <TimerInput
            timer={thang.timer}
            onChange={(timer) => update(index, { timer })}
            name={rows.length > 1 ? `thang ${index + 1}` : "the thang"}
            extra={
              <>
                {!thang.music && (
                  <button
                    type="button"
                    onClick={() => update(index, { music: { url: "" } })}
                    className="link py-1 text-sm"
                  >
                    <span className="text-accent">＋</span> Add music
                  </button>
                )}
                <LibraryButton
                  onAdd={(text) =>
                    update(index, {
                      text: thang.text.trim()
                        ? `${thang.text.trimEnd()}\n${text}`
                        : text,
                    })
                  }
                />
              </>
            }
          />
          {thang.music && (
            <MusicInput
              music={thang.music}
              onChange={(music) => update(index, { music })}
            />
          )}
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

/** "＋ Add timer", then a choice of kind, then that kind's settings. */
function TimerInput({
  timer,
  onChange,
  name,
  extra,
}: {
  timer?: Timer;
  onChange: (timer: Timer | undefined) => void;
  name: string;
  /** Shown beside "Add timer", e.g. "Add music". */
  extra?: React.ReactNode;
}) {
  const [choosing, setChoosing] = useState(false);

  if (!timer && !choosing)
    return (
      <div className="flex flex-wrap items-center gap-x-5">
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="link py-1 text-sm"
        >
          <span className="text-accent">＋</span> Add timer
        </button>
        {extra}
      </div>
    );

  // "Add music" and "Library" sit together on one row under the timer, whatever its state.
  const extras = extra && (
    <div className="flex flex-wrap items-center gap-x-5">{extra}</div>
  );

  if (!timer)
    return (
      <>
        <div className="flex flex-col gap-2 rounded-xl bg-hover p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">
              Which kind of timer?
            </span>
            <button
              type="button"
              onClick={() => setChoosing(false)}
              className="link text-sm"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TIMER_TYPES.map((option) => (
              <button
                key={option.type}
                type="button"
                onClick={() => {
                  setChoosing(false);
                  onChange(newTimer(option.type));
                }}
                className="flex flex-col items-start gap-0.5 rounded-xl border border-line bg-panel px-3 py-2 text-left transition-colors hover:border-accent/60"
              >
                <span className="text-sm font-medium text-ink">
                  {option.label}
                </span>
                <span className="text-xs text-muted">{option.description}</span>
              </button>
            ))}
          </div>
        </div>
        {extras}
      </>
    );

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl bg-hover p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-ink">
            {timerLabel(timer)}
          </span>
          <button
            type="button"
            aria-label={`Remove the timer for ${name}`}
            onClick={() => onChange(undefined)}
            className="link shrink-0 text-sm"
          >
            Remove
          </button>
        </div>
        <TimerSettings timer={timer} onChange={onChange} />
      </div>
      {extras}
    </>
  );
}

/** A link to a song or playlist for the thang, with an optional name. */
function MusicInput({
  music,
  onChange,
}: {
  music: NonNullable<Thang["music"]>;
  onChange: (music: Thang["music"]) => void;
}) {
  const valid = /^https?:\/\/\S+$/i.test(music.url.trim());
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-hover p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">♫ Music</span>
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="link shrink-0 text-sm"
        >
          Remove
        </button>
      </div>
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        Link to a song or playlist
        <input
          type="url"
          inputMode="url"
          placeholder="https://open.spotify.com/…"
          value={music.url}
          onChange={(e) => onChange({ ...music, url: e.target.value })}
          className="input py-1.5 text-base"
        />
        {music.url.trim() && !valid && (
          <span className="text-accent">
            Paste the full link, starting with https://
          </span>
        )}
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        Name (optional)
        <input
          placeholder="Eye of the Tiger"
          value={music.title ?? ""}
          onChange={(e) => onChange({ ...music, title: e.target.value })}
          className="input py-1.5 text-base"
        />
      </label>
    </div>
  );
}

/** The settings for the chosen kind of timer. */
function TimerSettings({
  timer,
  onChange,
}: {
  timer: Timer;
  onChange: (timer: Timer) => void;
}) {
  switch (timer.type) {
    case "stopwatch":
      return (
        <p className="text-xs text-muted">
          Counts up from 0:00 until stopped. Nothing to set.
        </p>
      );
    case "countdown":
    case "amrap":
      return (
        <TimeField
          label={timer.type === "amrap" ? "Time cap" : "Time"}
          seconds={timer.seconds}
          onChange={(seconds) => onChange({ ...timer, seconds })}
        />
      );
    case "intervals":
      return (
        <div className="flex flex-wrap gap-3">
          <TimeField
            label="Work"
            seconds={timer.work}
            onChange={(work) => onChange({ ...timer, work })}
          />
          <TimeField
            label="Rest"
            seconds={timer.rest}
            allowZero
            onChange={(rest) => onChange({ ...timer, rest })}
          />
          <CountField
            label="Rounds"
            value={timer.rounds}
            onChange={(rounds) => onChange({ ...timer, rounds })}
          />
        </div>
      );
    case "emom":
      return (
        <div className="flex flex-wrap gap-3">
          <TimeField
            label="Every"
            seconds={timer.every}
            onChange={(every) => onChange({ ...timer, every })}
          />
          <CountField
            label="Rounds"
            value={timer.rounds}
            onChange={(rounds) => onChange({ ...timer, rounds })}
          />
        </div>
      );
  }
}

/** A time typed as minutes or m:ss, saved once it reads as one. */
function TimeField({
  label,
  seconds,
  onChange,
  allowZero = false,
}: {
  label: string;
  seconds: number;
  onChange: (seconds: number) => void;
  allowZero?: boolean;
}) {
  const [text, setText] = useState(formatTimer(seconds));
  const parsed =
    allowZero && text.trim().match(/^0+(:0+)?$/) ? 0 : parseTime(text);
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-soft">
      {label}
      <input
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const next =
            allowZero && e.target.value.trim().match(/^0+(:0+)?$/)
              ? 0
              : parseTime(e.target.value);
          if (next !== null) onChange(next);
        }}
        onBlur={() => parsed !== null && setText(formatTimer(parsed))}
        aria-invalid={parsed === null}
        className="input w-24 py-1.5 text-base"
      />
      {parsed === null && <span className="text-accent">Like 5 or 4:30</span>}
    </label>
  );
}

/**
 * A whole number of rounds, 1 to 99. What's typed is kept as typed (so the box can be cleared to
 * type a new number) and saved once it's a number in range.
 */
function CountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const valid = (t: string) => /^\d{1,2}$/.test(t.trim()) && Number(t) >= 1;
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-soft">
      {label}
      <input
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (valid(e.target.value)) onChange(Number(e.target.value));
        }}
        onBlur={() => setText(String(value))}
        aria-invalid={!valid(text)}
        className="input w-20 py-1.5 text-base"
      />
      {!valid(text) && <span className="text-accent">1 to 99</span>}
    </label>
  );
}
