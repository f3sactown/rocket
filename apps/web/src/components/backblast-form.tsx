"use client";

import {
  DEFAULT_INTRODUCTION,
  FIA_DISCLAIMER,
  attendeeFromName,
  joinQs,
  qNames,
  backblastParts,
  copyText,
  copyWorkout,
  formatDate,
  thangText,
  type Thang,
  WORKOUT_SECTIONS,
  formatBackblast,
  termsFor,
  titleCase,
  type Language,
  paxCount,
  type Backblast,
} from "@rocket/core";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadRosterIn,
  loadSitesIn,
  nextDateOn,
  sitesByDay,
} from "@/lib/regions";
import { useLoad, useRegionScope } from "@/lib/use-region";
import { useWorkoutLink } from "@/lib/workout-link";
import { AttendanceInput } from "./attendance-input";
import { LibraryButton } from "./library-picker";
import { QPicker } from "./q-picker";
import { ThangsInput } from "./thangs-input";
import { Regulars } from "./regulars";
import { useAuth } from "./auth-provider";
import { ArrowIcon, PencilIcon, SkipIcon, TrashIcon } from "./icons";
import { ProtectedText } from "./protected-text";
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
  | "notes"
  | "announcements"
  | "wordsOfWisdom"
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
      /** Whether the page has no saved templates. */
      noTemplates?: boolean;
    }
  | { kind: "attendance"; title: string; hint: string }
  /** A backblast's copy of its workout's sections, all on one page. */
  | { kind: "workout"; title: string; hint: string }
  | { kind: "review"; title: string; hint: string };

/** Which form: the workout (the plan) or the backblast written from it. */
export type FormMode = "workout" | "backblast";

/** The workout sections a backblast shows on its Workout page, below the basics. */
const WORKOUT_TEXT: TextKey[] = [
  "introduction",
  "warmup",
  "thang",
  "wordsOfWisdom",
];

/** Every page either form can have, worded for the user's vocabulary, by key. */
function allSteps(language: Language): Step[] {
  const terms = termsFor(language);
  return [
    {
      kind: "basics",
      title: "Basics",
      hint: `The title, AO, date and time for this ${terms.beatdown}.`,
    },
    {
      kind: "text",
      name: "introduction",
      title: "Introduction",
      hint: "The preamble to include the mission statement, core principles, disclaimer, and credo",
      // A built-in template for each organization: F3's welcome, mission, principles and credo, or
      // FiA's disclaimer.
      builtIns:
        language === "f3"
          ? [{ name: "F3 standard", body: DEFAULT_INTRODUCTION }]
          : [{ name: "FiA Disclaimer", body: FIA_DISCLAIMER }],
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
      kind: "text",
      name: "notes",
      title: "Notes",
      hint: "Anything else about the workout",
      noTemplates: true,
    },
    {
      kind: "workout",
      title: "Workout",
      hint: "This backblast's copy of the workout. Edit it here for anything that went differently; the workout itself isn't changed.",
    },
    {
      kind: "attendance",
      title: "Name-o-rama",
      hint: "The Q and the names of the PAX who attended. The Q is counted automatically. Mark downrange PAX with their home region, FNGs with who invited them, and 2.0s.",
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

/** The pages of a workout or a backblast, in order. */
function stepsFor(language: Language, mode: FormMode): Step[] {
  const all = allSteps(language);
  const text = (name: TextKey) =>
    all.find((step) => step.kind === "text" && step.name === name)!;
  const kind = (k: Step["kind"]) => all.find((step) => step.kind === k)!;
  return mode === "workout"
    ? [
        kind("basics"),
        text("introduction"),
        text("warmup"),
        text("thang"),
        {
          ...text("notes"),
          hint: "Notes for you as the Q only. No one else sees them, and they're left out when the workout is copied or shared.",
        },
        text("wordsOfWisdom"),
        { ...kind("review"), hint: "The workout as it will be copied." },
      ]
    : [
        kind("workout"),
        text("notes"),
        kind("attendance"),
        text("announcements"),
        text("secondF"),
        kind("review"),
      ];
}

/** Text with more added on its own line. */
export function appendText(current: string | undefined, more: string): string {
  const text = current?.trimEnd() ?? "";
  return text ? `${text}\n${more}` : more;
}

/** Today's date (YYYY-MM-DD) where the user is. */
function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The workout's part of a backblast as text: where and when, then its sections (not the notes). */
function workoutText(backblast: Backblast, language: Language): string {
  const workout: Backblast = {
    title: "",
    date: "",
    ao: "",
    q: "",
    attendees: [],
  };
  for (const key of WORKOUT_SECTIONS) workout[key] = backblast[key] ?? "";
  return formatBackblast(workout, language);
}

/** The title for each text section, for the Workout page's fields. */
function textTitle(steps: Step[], name: TextKey): string {
  const step = steps.find((s) => s.kind === "text" && s.name === name);
  return step?.title ?? name;
}

/** Whether a page has anything filled in, for the progress bar and review list. */
function isFilled(step: Step, backblast: Backblast): boolean {
  switch (step.kind) {
    case "basics":
    case "workout":
      return Boolean(
        backblast.title.trim() && backblast.date && backblast.ao.trim(),
      );
    case "text":
      return Boolean(backblast[step.name]?.trim());
    case "attendance":
      return backblast.attendees.length > 0 || qNames(backblast).length > 0;
    case "review":
      return false;
  }
}

/** The AO menu's choice for typing an AO that isn't listed. */
const OTHER_AO = "__other";

export function BackblastForm({
  mode = "backblast",
  onCopyWorkout,
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
  mode?: FormMode;
  /**
   * For a backblast made from a workout: fetches the workout's sections again, returning the
   * workout (or an error message).
   */
  onCopyWorkout?: () => Promise<Backblast | string>;
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
  // A shared backblast ends with a link to its workout, when it has a public one.
  const workoutLink = useWorkoutLink(
    mode === "backblast" ? backblast.workoutId : undefined,
  );
  // The user's region's sheet supplies AO suggestions (with locations) and PAX names; with "all F3
  // (or FiA) regions", every such region's do.
  const scope = useRegionScope();
  const scopeKey = scope?.regions.map((r) => r.id).join() ?? "";
  const sites = useLoad(scope ? () => loadSitesIn(scope.regions) : null, [
    scopeKey,
  ]);
  const roster = useLoad(scope ? () => loadRosterIn(scope.regions) : null, [
    scopeKey,
  ]);
  // An AO typed by hand, for one that isn't on the region's list.
  const [typingAo, setTypingAo] = useState(false);
  // The date the AO filled in, so picking another AO can change it but a chosen date stays.
  const autoDate = useRef<string | null>(null);
  const customAo =
    typingAo ||
    (!!backblast.ao &&
      !!sites.value &&
      !sites.value.some((s) => s.name === backblast.ao));
  const steps = useMemo(() => stepsFor(language, mode), [language, mode]);
  const lastStep = steps.length - 1;
  // What the review's Share button gives, and what copying its text gives too. A workout's notes
  // are the Q's own, so they aren't shared.
  const reviewCopyText =
    mode === "workout"
      ? formatBackblast({ ...backblast, notes: "" }, language)
      : copyText(backblast, language, workoutLink);
  const step = steps[stepIndex]!;
  const allText = useMemo(() => stepsFor(language, "workout"), [language]);
  // A backblast is written after its workout, so it can't be finished before the workout's date.
  const tooEarly =
    mode === "backblast" && !!backblast.date && backblast.date > localToday();
  const [copying, setCopying] = useState(false);
  // Whether the backblast's copy of its workout is open for editing.
  const [editingCopy, setEditingCopy] = useState(false);

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
    setStepIndex(Math.max(0, Math.min(lastStep, index)));
  }

  async function save() {
    if (!isFilled(steps[0]!, backblast)) {
      setError(
        `Add a title, date and AO on the ${steps[0]!.title} page first.`,
      );
      return;
    }
    if (tooEarly) {
      setError(
        `This backblast can be finished on ${formatDate(backblast.date)}, the day of the workout.`,
      );
      return;
    }
    if (mode === "backblast" && qNames(backblast).length === 0) {
      setError("Choose the Q on the Name-o-rama page first.");
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

  /** Sets the workout's thangs and the written-out Thang text that goes with them. */
  function setThangs(thangs: Thang[]) {
    edited.current = true;
    setBackblast((current) => ({
      ...current,
      thangs,
      thang: thangText(thangs),
    }));
  }

  /** Loads a saved template into a section; on a workout, a Thang template becomes a new thang. */
  function loadTemplate(name: TextKey, body: string) {
    if (mode === "workout" && name === "thang") {
      const current = (
        backblast.thangs ?? [{ text: backblast.thang ?? "" }]
      ).filter((t) => t.text.trim() || t.timer || t.music);
      return setThangs([...current, { text: body }]);
    }
    set(name, body);
  }

  /** Replaces the Workout page's sections with the workout's current ones. */
  async function copyAgain() {
    if (!onCopyWorkout) return;
    setCopying(true);
    setError(null);
    const workout = await onCopyWorkout();
    setCopying(false);
    if (typeof workout === "string") return setError(workout);
    edited.current = true;
    setBackblast((current) => copyWorkout(current, workout));
    setEditingCopy(false);
  }

  /**
   * Sets the AO and, for an AO from the region's sheet, adds its location and time, and the next
   * date it meets unless the user already chose a date.
   */
  function chooseAo(ao: string) {
    set("ao", ao);
    // The AO's location (usually a park) goes in the backblast with it.
    const site = sites.value?.find((s) => s.name === ao);
    set("address", site?.address ?? "");
    if (site?.time) set("time", site.time);
    const date = site?.day && nextDateOn(site.day, site.time);
    if (date && (!backblast.date || backblast.date === autoDate.current)) {
      autoDate.current = date;
      set("date", date);
    }
  }

  const basicsFields = (
    <>
      <label className="label flex flex-col gap-1.5">
        Title
        <input
          value={backblast.title}
          onChange={(e) => set("title", e.target.value)}
          // Capitalized like a title once you're done typing it.
          onBlur={(e) => {
            const cased = titleCase(e.target.value);
            if (cased !== e.target.value) set("title", cased);
          }}
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
                    {site.name}
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
        Date
        <input
          type="date"
          value={backblast.date}
          onChange={(e) => set("date", e.target.value)}
          className="input text-base"
        />
      </label>
      <label className="label flex flex-col gap-1.5">
        Time
        <input
          value={backblast.time ?? ""}
          onChange={(e) => set("time", e.target.value)}
          placeholder="5:15am-6:00am"
          className="input text-base"
        />
      </label>
    </>
  );

  return (
    <form
      // Enter in a single-line field moves to the next page; saving happens on the last page.
      onSubmit={(event) => {
        event.preventDefault();
        if (stepIndex < lastStep) goTo(stepIndex + 1);
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

      <nav
        aria-label={
          mode === "workout" ? "Workout sections" : "Backblast sections"
        }
        className="flex flex-col gap-2"
      >
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
          {step.kind === "text" &&
            mode === "workout" &&
            step.name === "warmup" && (
              // The exercise and routine library, top right beside the templates. (Each thang
              // has its own, on The Thang.)
              <LibraryButton
                onAdd={(text) =>
                  set("warmup", appendText(backblast.warmup, text))
                }
              />
            )}
          {step.kind === "text" && !step.noTemplates && (
            <SectionTemplates
              userId={userId}
              section={step.name}
              label={step.title}
              body={backblast[step.name] ?? ""}
              templates={templates}
              builtIns={step.builtIns}
              onLoad={(body) => loadTemplate(step.name, body)}
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
          <div className="flex flex-col gap-4">{basicsFields}</div>
        )}

        {step.kind === "workout" &&
          (backblast.workoutId && !editingCopy ? (
            <div className="flex flex-col gap-3">
              <pre className="rounded-xl border border-line p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
                {workoutText(backblast, language) || "The workout is empty."}
              </pre>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <button
                  type="button"
                  onClick={() => setEditingCopy(true)}
                  className="link inline-flex items-center gap-1.5"
                >
                  <PencilIcon />
                  Edit
                </button>
                <a
                  href={`${process.env.NEXT_PUBLIC_BASE_PATH}/workout/?id=${backblast.workoutId}`}
                  className="link"
                >
                  Open workout
                </a>
                {onCopyWorkout && (
                  <button
                    type="button"
                    disabled={copying}
                    onClick={copyAgain}
                    className="link"
                  >
                    {copying ? "Updating…" : "Update from workout"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            // The backblast's own copy of the workout. Editing it never changes the workout.
            <div className="flex flex-col gap-4">
              {backblast.workoutId && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink-soft">
                  <span>
                    Changes here are only for this backblast. The workout stays
                    as it is.
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingCopy(false)}
                    className="link shrink-0 font-medium text-ink"
                  >
                    Done
                  </button>
                </div>
              )}
              {basicsFields}
              {WORKOUT_TEXT.map((name) => (
                <label key={name} className="label flex flex-col gap-1.5">
                  {textTitle(allText, name)}
                  <textarea
                    value={backblast[name] ?? ""}
                    onChange={(e) => set(name, e.target.value)}
                    className="input min-h-56 resize-y text-base leading-relaxed"
                  />
                </label>
              ))}
            </div>
          ))}

        {step.kind === "text" &&
          mode === "workout" &&
          step.name === "thang" && (
            <ThangsInput
              value={backblast.thangs ?? [{ text: backblast.thang ?? "" }]}
              onChange={setThangs}
              placeholder={step.hint}
            />
          )}

        {step.kind === "text" &&
          !(mode === "workout" && step.name === "thang") && (
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
            <QPicker
              // Every row, including blank ones just added.
              value={backblast.q.split(",").map((name) => name.trim())}
              onChange={(qs) => set("q", joinQs(qs))}
              roster={roster.value}
            />
            {scope && (
              <Regulars
                regions={scope.regions}
                ao={backblast.ao}
                qs={qNames(backblast)}
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
            {tooEarly && (
              <p className="rounded-xl border border-line px-3 py-2 text-sm text-ink-soft">
                You can finish this backblast on{" "}
                <span className="text-ink">{formatDate(backblast.date)}</span>,
                the day of the workout. It&apos;s saved as a draft until then.
              </p>
            )}
            <ul className="flex flex-wrap gap-2">
              {steps.slice(0, lastStep).map((s, index) => {
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
                <ProtectedText
                  copyText={reviewCopyText}
                  className="overflow-x-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink-soft"
                >
                  {part.text}
                </ProtectedText>
              </section>
            ))}
            <ShareButton
              title={backblast.title}
              text={reviewCopyText}
              className="btn w-full px-4 text-base"
            />
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-accent">
          {error}{" "}
          {error.includes(steps[0]!.title) && (
            <button type="button" onClick={() => goTo(0)} className="underline">
              Go to {steps[0]!.title}
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
        {stepIndex < lastStep ? (
          <button
            type="submit"
            className="btn gap-2 px-4 text-base whitespace-nowrap"
          >
            Next →
          </button>
        ) : (
          <button
            type="submit"
            disabled={saving || tooEarly}
            className="btn gap-2 px-4 text-base whitespace-nowrap disabled:opacity-50"
          >
            <ArrowIcon />
            {saving ? "Saving…" : saveLabel}
          </button>
        )}
      </div>
      {stepIndex < lastStep && (
        <button
          type="button"
          onClick={() => goTo(lastStep)}
          className="link -mt-2 inline-flex items-center gap-1.5 self-center"
        >
          Skip to review
          <SkipIcon />
        </button>
      )}
      {onDiscard && (
        <button
          type="button"
          onClick={() => {
            if (confirm("Discard this draft? This can't be undone."))
              onDiscard();
          }}
          className="link -mt-2 inline-flex items-center gap-1.5 self-center hover:text-accent"
        >
          <TrashIcon />
          Discard draft
        </button>
      )}
    </form>
  );
}
