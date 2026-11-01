"use client";

import {
  DEFAULT_INTRODUCTION,
  attendeeFromName,
  attendeeLabel,
  backblastParts,
  formatBackblast,
  termsFor,
  type Language,
  paxCount,
  type Backblast,
} from "@rocket/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseAttendees } from "@/lib/backblast";
import { loadRoster, loadSites, sitesByDay } from "@/lib/regions";
import { useLoad, useUserRegion } from "@/lib/use-region";
import { AttendanceInput } from "./attendance-input";
import { Regulars } from "./regulars";
import { useAuth } from "./auth-provider";
import { ArrowIcon } from "./icons";
import { ShareButton } from "./share-button";
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

/** The pages of the form, worded for the user's vocabulary. */
function stepsFor(language: Language): Step[] {
  const terms = termsFor(language);
  return [
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
      // The built-in text is F3's mission, principles and credo, so it's offered in F3 only.
      builtIns:
        language === "f3"
          ? [{ name: "F3 standard", body: DEFAULT_INTRODUCTION }]
          : undefined,
    },
    {
      kind: "text",
      name: "warmup",
      title: terms.warmup,
      hint: "Stretches and warm-up to target muscle groups the PAX will be using during the workout",
    },
    {
      kind: "text",
      name: "thang",
      title: terms.thang,
      hint: "The actual workout",
    },
    {
      kind: "attendance",
      title: "Name-o-rama",
      hint: "The names of the PAX who attended. The Q is counted automatically. Mark downrange PAX with their home region, FNGs with who invited them, and 2.0s.",
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
      title: terms.thirdF,
      hint: "Prayer requests, special intentions, or praises",
    },
    {
      kind: "text",
      name: "secondF",
      title: terms.secondF,
      hint: "Usually coffee",
    },
    {
      kind: "review",
      title: "Review",
      hint: "What gets copied, split into its three parts here for checking (the copied text has no headings). Tap a section to change it.",
    },
  ];
}

const LAST_STEP = stepsFor("f3").length - 1;

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

/** The AO menu's choice for typing an AO that isn't listed. */
const OTHER_AO = "__other";

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
  const language = useAuth().user?.language ?? "f3";
  // The user's region's sheet supplies AO suggestions (with addresses) and PAX names.
  const region = useUserRegion();
  const sites = useLoad(region ? () => loadSites(region) : null, [region?.id]);
  const roster = useLoad(region ? () => loadRoster(region) : null, [
    region?.id,
  ]);
  // An AO typed by hand, for one that isn't on the region's list.
  const [typingAo, setTypingAo] = useState(false);
  const customAo =
    typingAo ||
    (!!backblast.ao &&
      !!sites.value &&
      !sites.value.some((s) => s.name === backblast.ao));
  const steps = useMemo(() => stepsFor(language), [language]);
  const step = steps[stepIndex];

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
    if (!isFilled(steps[0], backblast)) {
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

  /** Sets the AO and, for an AO from the region's sheet, adds its location. */
  function chooseAo(ao: string) {
    set("ao", ao);
    // The AO's location (usually a park) goes in the backblast with it.
    const site = sites.value?.find((s) => s.name === ao);
    set("address", site?.address ?? "");
  }

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
          {steps.map((s, index) => (
            <button
              key={s.title}
              type="button"
              aria-label={`Go to ${s.title}`}
              aria-current={index === stepIndex ? "step" : undefined}
              onClick={() => goTo(index)}
              className="group relative flex-1 py-2"
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
              {/* Step name on hover or keyboard focus; kept inside the card at the ends. */}
              <span
                aria-hidden
                className={`pointer-events-none absolute bottom-full z-10 mb-1 rounded-lg border border-line-strong bg-surface-raised px-2 py-1 text-xs font-medium whitespace-nowrap text-ink opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${
                  index === 0
                    ? "left-0"
                    : index === steps.length - 1
                      ? "right-0"
                      : "left-1/2 -translate-x-1/2"
                }`}
              >
                {s.title}
              </span>
            </button>
          ))}
        </div>
        <p className="font-mono text-xs text-muted">
          Step {stepIndex + 1} of {steps.length}
          <span className="text-ink-soft"> · {step.title}</span>
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
              {sites.value?.length ? (
                <select
                  value={customAo ? OTHER_AO : backblast.ao}
                  onChange={(e) => {
                    if (e.target.value === OTHER_AO) {
                      setTypingAo(true);
                      set("ao", "");
                      set("address", "");
                    } else {
                      setTypingAo(false);
                      chooseAo(e.target.value);
                    }
                  }}
                  className="input text-base"
                >
                  <option value="">Choose an AO…</option>
                  {sitesByDay(sites.value).map((group) => (
                    <optgroup key={group.day} label={group.day}>
                      {group.sites.map((site) => (
                        <option key={site.name} value={site.name}>
                          {[site.name, site.time].filter(Boolean).join(" · ")}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <option value={OTHER_AO}>Other…</option>
                </select>
              ) : null}
              {(customAo || !sites.value?.length) && (
                <input
                  value={backblast.ao}
                  onChange={(e) => set("ao", e.target.value)}
                  placeholder={sites.value?.length ? "AO name" : undefined}
                  className="input text-base"
                />
              )}
              {sites.error && (
                <span className="text-xs font-normal text-accent">
                  AO list unavailable: {sites.error}
                </span>
              )}
            </label>
            <label className="label flex flex-col gap-1.5">
              Q
              <input
                value={backblast.q}
                list="region-q-names"
                onChange={(e) => set("q", e.target.value)}
                className="input text-base"
              />
              {roster.value && (
                <datalist id="region-q-names">
                  {roster.value.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              )}
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
          <>
            {region && (
              <Regulars
                region={region}
                ao={backblast.ao}
                q={backblast.q}
                attendees={backblast.attendees}
                onAdd={(names) =>
                  set("attendees", [
                    // Fill an empty row first, then add the rest.
                    ...backblast.attendees.filter((a) => a.name.trim()),
                    ...names.map(attendeeFromName),
                  ])
                }
              />
            )}
            <AttendanceInput
              value={backblast.attendees}
              onChange={(a) => set("attendees", a)}
              suggestions={roster.value}
            />
          </>
        )}

        {step.kind === "review" && (
          <>
            <ul className="flex flex-wrap gap-2">
              {steps.slice(0, LAST_STEP).map((s, index) => {
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
            {backblastParts(backblast, language).map((part) => (
              <section
                key={part.title}
                className="overflow-hidden rounded-xl border border-line"
              >
                <h3 className="border-b border-line bg-hover px-4 py-2 text-xs font-semibold tracking-wider text-accent uppercase">
                  {part.title}
                </h3>
                <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
                  {part.text}
                </pre>
              </section>
            ))}
            <ShareButton
              title={backblast.title}
              text={formatBackblast(backblast, language)}
              className="btn w-full px-4 text-base"
            />
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

      <div
        className={`grid gap-3 ${stepIndex === 0 ? "grid-cols-1" : "grid-cols-[auto_1fr]"}`}
      >
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={() => goTo(stepIndex - 1)}
            className="btn gap-2 px-4 text-base whitespace-nowrap"
          >
            ← Previous
          </button>
        )}
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
