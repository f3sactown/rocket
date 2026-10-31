"use client";

import {
  DEFAULT_INTRODUCTION,
  attendeeLabel,
  formatBackblast,
  paxCount,
  type Backblast,
} from "@rocket/core";
import { useEffect, useRef, useState } from "react";
import { parseAttendees } from "@/lib/backblast";
import { AttendanceInput } from "./attendance-input";
import { ArrowIcon } from "./icons";
import {
  SectionTemplates,
  type BuiltInTemplate,
  type SectionTemplate,
} from "./section-templates";

type TextKey =
  | "introduction"
  | "warmup"
  | "thang"
  | "announcements"
  | "wordsOfWisdom"
  | "thirdF"
  | "secondF";

/** One page of the backblast form. */
type Step =
  | { kind: "basics"; title: string; hint: string }
  | {
      kind: "text";
      name: TextKey;
      title: string;
      hint: string;
      builtIns?: BuiltInTemplate[];
    }
  | { kind: "attendance"; title: string; hint: string }
  | { kind: "review"; title: string; hint: string };

const STEPS: Step[] = [
  {
    kind: "basics",
    title: "Basics",
    hint: "The title, date, AO and Q for this beatdown.",
  },
  {
    kind: "text",
    name: "introduction",
    title: "Introduction",
    hint: "The preamble to include the mission statement, core principles, disclaimer, and credo",
    builtIns: [{ name: "F3 standard", body: DEFAULT_INTRODUCTION }],
  },
  {
    kind: "text",
    name: "warmup",
    title: "Warm-o-rama",
    hint: "Stretches and warm-up to target muscle groups the PAX will be using during the workout",
  },
  {
    kind: "text",
    name: "thang",
    title: "The Thang",
    hint: "The actual workout",
  },
  {
    kind: "attendance",
    title: "Name-o-rama",
    hint: "The names of the PAX who attended. The Q is counted automatically. Mark visitors with their home region, FNGs with who invited them, and 2.0s.",
  },
  {
    kind: "text",
    name: "announcements",
    title: "Announcements",
    hint: "The site Q will have the normal announcements, this is a place for any other announcements that need to be said",
  },
  {
    kind: "text",
    name: "wordsOfWisdom",
    title: "Words of Wisdom",
    hint: "The wisdom you'd like to bestow onto the PAX this day",
  },
  {
    kind: "text",
    name: "thirdF",
    title: "Third F",
    hint: "Prayer requests, special intentions, or praises",
  },
  {
    kind: "text",
    name: "secondF",
    title: "Second F",
    hint: "Usually coffee",
  },
  {
    kind: "review",
    title: "Review",
    hint: "This is exactly what gets copied to Slack. Tap a section to change it.",
  },
];

const LAST_STEP = STEPS.length - 1;

/** Whether a page has anything filled in, for the progress bar and review list. */
function isFilled(step: Step, backblast: Backblast): boolean {
  switch (step.kind) {
    case "basics":
      return Boolean(
        backblast.title.trim() &&
        backblast.date &&
        backblast.ao.trim() &&
        backblast.q.trim(),
      );
    case "text":
      return Boolean(backblast[step.name]?.trim());
    case "attendance":
      return backblast.attendees.length > 0;
    case "review":
      return false;
  }
}

function attendeesPreview(body: string): string {
  try {
    return parseAttendees(JSON.parse(body)).map(attendeeLabel).join(", ");
  } catch {
    return "";
  }
}

export function BackblastForm({
  heading,
  status,
  saveLabel,
  initial,
  onChange,
  onSave,
  onDiscard,
  userId,
  initialTemplates,
}: {
  heading: string;
  /** Short save state shown in the header, e.g. "Draft saved". */
  status: string;
  saveLabel: string;
  initial: Backblast;
  /** Called after every edit, with the whole backblast. */
  onChange: (backblast: Backblast) => void;
  /** Publishes the backblast; returns an error message on failure. */
  onSave: (backblast: Backblast) => Promise<string | void>;
  /** Throws away the draft; omitted when there's no draft to discard. */
  onDiscard?: () => void;
  userId: string;
  initialTemplates: SectionTemplate[];
}) {
  const [backblast, setBackblast] = useState<Backblast>(initial);
  const [templates, setTemplates] = useState(initialTemplates);
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const edited = useRef(false);
  const page = useRef<HTMLDivElement>(null);
  const navigated = useRef(false);
  const step = STEPS[stepIndex];

  // Report edits (not the initial render) so the draft can be saved.
  useEffect(() => {
    if (edited.current) onChange(backblast);
  }, [backblast, onChange]);

  // On each new page, start at the top and put the cursor in its main field.
  useEffect(() => {
    if (!navigated.current) return;
    window.scrollTo({ top: 0 });
    page.current
      ?.querySelector<HTMLElement>("textarea, input:not([type=hidden])")
      ?.focus({ preventScroll: true });
  }, [stepIndex]);

  function goTo(index: number) {
    navigated.current = true;
    setError(null);
    setStepIndex(Math.max(0, Math.min(LAST_STEP, index)));
  }

  async function save() {
    if (!isFilled(STEPS[0], backblast)) {
      setError("Add a title, date, AO and Q on the Basics page first.");
      return;
    }
    setSaving(true);
    setError(null);
    const message = await onSave(backblast);
    if (message) {
      setError(message);
      setSaving(false);
    }
  }

  const set = <K extends keyof Backblast>(key: K, value: Backblast[K]) => {
    edited.current = true;
    setBackblast((current) => ({ ...current, [key]: value }));
  };

  return (
    <form
      // Enter in a single-line field moves to the next page; saving happens on the last page.
      onSubmit={(event) => {
        event.preventDefault();
        if (stepIndex < LAST_STEP) goTo(stepIndex + 1);
        else save();
      }}
      className="card"
    >
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-lg font-semibold tracking-tight text-ink-soft">
          {heading}
        </h1>
        <span className="status shrink-0">{status}</span>
      </header>

      <nav aria-label="Backblast sections" className="flex flex-col gap-2">
        <div className="flex gap-1">
          {STEPS.map((s, index) => (
            <button
              key={s.title}
              type="button"
              aria-label={`Go to ${s.title}`}
              aria-current={index === stepIndex ? "step" : undefined}
              onClick={() => goTo(index)}
              className="group flex-1 py-2"
            >
              <span
                className={`block h-1.5 rounded-full transition-colors ${
                  index === stepIndex
                    ? "bg-accent shadow-[0_0_8px_var(--color-accent)]"
                    : isFilled(s, backblast)
                      ? "bg-ink-soft/60 group-hover:bg-ink-soft"
                      : "bg-line-strong group-hover:bg-muted"
                }`}
              />
            </button>
          ))}
        </div>
        <p className="font-mono text-xs text-muted">
          Step {stepIndex + 1} of {STEPS.length}
        </p>
      </nav>

      <div ref={page} className="panel flex min-h-[55vh] flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <h2 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-ink">
            {step.title}
          </h2>
          {step.kind === "text" && (
            <SectionTemplates
              userId={userId}
              section={step.name}
              label={step.title}
              body={backblast[step.name] ?? ""}
              templates={templates}
              builtIns={step.builtIns}
              onLoad={(body) => set(step.name, body)}
              onTemplatesChange={setTemplates}
            />
          )}
          {step.kind === "attendance" && (
            <SectionTemplates
              userId={userId}
              section="attendees"
              label="Name-o-rama"
              body={JSON.stringify(backblast.attendees)}
              preview={attendeesPreview}
              templates={templates}
              onLoad={(body) =>
                set("attendees", parseAttendees(JSON.parse(body)))
              }
              onTemplatesChange={setTemplates}
            />
          )}
        </div>
        {step.kind === "attendance" && (
          <p className="-mt-2 text-sm text-ink-soft">
            Count-o-rama{" "}
            <span className="ml-1 font-mono text-lg text-ink">
              {paxCount(backblast)}
            </span>
          </p>
        )}
        {step.kind !== "text" && (
          <p className="text-sm text-muted">{step.hint}</p>
        )}

        {step.kind === "basics" && (
          <div className="flex flex-col gap-4">
            <label className="label flex flex-col gap-1.5">
              Title
              <input
                value={backblast.title}
                onChange={(e) => set("title", e.target.value)}
                className="input text-base"
              />
            </label>
            <label className="label flex flex-col gap-1.5">
              Date
              <input
                type="date"
                value={backblast.date}
                onChange={(e) => set("date", e.target.value)}
                className="input text-base"
              />
            </label>
            <label className="label flex flex-col gap-1.5">
              AO
              <input
                value={backblast.ao}
                onChange={(e) => set("ao", e.target.value)}
                className="input text-base"
              />
            </label>
            <label className="label flex flex-col gap-1.5">
              Q
              <input
                value={backblast.q}
                onChange={(e) => set("q", e.target.value)}
                className="input text-base"
              />
            </label>
          </div>
        )}

        {step.kind === "text" && (
          <textarea
            key={step.name}
            aria-label={step.title}
            placeholder={step.hint}
            value={backblast[step.name] ?? ""}
            onChange={(e) => set(step.name, e.target.value)}
            className="input min-h-[40vh] flex-1 resize-y text-base leading-relaxed"
          />
        )}

        {step.kind === "attendance" && (
          <AttendanceInput
            value={backblast.attendees}
            onChange={(a) => set("attendees", a)}
          />
        )}

        {step.kind === "review" && (
          <>
            <ul className="flex flex-wrap gap-2">
              {STEPS.slice(0, LAST_STEP).map((s, index) => {
                const filled = isFilled(s, backblast);
                return (
                  <li key={s.title}>
                    <button
                      type="button"
                      onClick={() => goTo(index)}
                      className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm whitespace-nowrap transition-colors hover:bg-hover"
                    >
                      <span
                        className={`size-2 shrink-0 rounded-full ${filled ? "bg-accent" : "bg-line-strong"}`}
                      />
                      <span className={filled ? "text-ink" : "text-muted"}>
                        {s.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <pre className="overflow-x-auto rounded-xl border border-line p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
              {formatBackblast(backblast)}
            </pre>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-accent">
          {error}{" "}
          {error.includes("Basics") && (
            <button type="button" onClick={() => goTo(0)} className="underline">
              Go to Basics
            </button>
          )}
        </p>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-3">
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => goTo(stepIndex - 1)}
          className="btn gap-2 px-4 text-base whitespace-nowrap disabled:invisible"
        >
          ← Previous
        </button>
        {stepIndex < LAST_STEP ? (
          <button
            type="submit"
            className="btn gap-2 px-4 text-base whitespace-nowrap"
          >
            Next →
          </button>
        ) : (
          <button
            type="submit"
            disabled={saving}
            className="btn gap-2 px-4 text-base whitespace-nowrap"
          >
            <ArrowIcon />
            {saving ? "Saving…" : saveLabel}
          </button>
        )}
      </div>
      {stepIndex < LAST_STEP && (
        <button
          type="button"
          onClick={() => goTo(LAST_STEP)}
          className="link -mt-2 self-center"
        >
          Skip to review
        </button>
      )}
      {onDiscard && (
        <button
          type="button"
          onClick={() => {
            if (confirm("Discard this draft? This can't be undone."))
              onDiscard();
          }}
          className="link -mt-2 self-center"
        >
          Discard draft
        </button>
      )}
    </form>
  );
}
