"use client";

import {
  generatedThang,
  generateWorkout,
  sectionText,
  timerLabel,
  type GeneratedSection,
  type GeneratedWorkout,
} from "@rocket/core";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SignedIn } from "@/components/auth-provider";
import { ArrowIcon, SparkleIcon } from "@/components/icons";
import {
  ExiconFilterControls,
  useExiconFilters,
} from "@/components/library-picker";
import { keepGenerated } from "@/lib/generated-workout";
import { loadLibrary } from "@/lib/library";
import { useLoad } from "@/lib/use-region";
import { TriCheckbox } from "@/components/tri-checkbox";

/** How many tags to choose. */
const MIN_TAGS = 2;
const MAX_TAGS = 5;

export default function GenerateWorkoutPage() {
  return <SignedIn>{() => <GenerateWorkout />}</SignedIn>;
}

/**
 * Generate workout: choose 2 to 5 of the Exicon's tags (and, as on the Exicon, which sources and
 * exercises or routines), and Rocket puts a Warm-o-rama and thangs together from them at random.
 * Generate again for another; "Create workout from these" opens New workout with them filled in.
 */
function GenerateWorkout() {
  const router = useRouter();
  const library = useLoad(loadLibrary, []);
  const entries = useMemo(() => library.value ?? [], [library.value]);
  const filters = useExiconFilters(entries, { maxTags: MAX_TAGS });
  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  // Whether each section shows (and copies) its descriptions: the Warm-o-rama, then each thang.
  const [descriptions, setDescriptions] = useState<{
    warmup: boolean;
    thangs: boolean[];
  }>({ warmup: true, thangs: [] });
  const enough =
    filters.tags.length >= MIN_TAGS && filters.tags.length <= MAX_TAGS;

  const sections = workout
    ? [descriptions.warmup, ...workout.thangs.map((_, i) => thangOn(i))]
    : [];
  const allOn = sections.length > 0 && sections.every(Boolean);
  const someOn = sections.some(Boolean);
  function thangOn(index: number) {
    return descriptions.thangs[index] ?? descriptions.warmup;
  }

  function generate() {
    const next = generateWorkout(entries.filter(filters.inScope), filters.tags);
    setWorkout(next);
    // A new one keeps the choice: all on or all off as before (some: as the Warm-o-rama was).
    setDescriptions((d) => ({
      warmup: d.warmup,
      thangs: next.thangs.map(() =>
        allOn || !workout ? true : someOn ? d.warmup : false,
      ),
    }));
  }

  function setAll(on: boolean) {
    setDescriptions({
      warmup: on,
      thangs: (workout?.thangs ?? []).map(() => on),
    });
  }

  function create() {
    if (!workout) return;
    keepGenerated({
      warmup: sectionText(workout.warmup, descriptions.warmup),
      thangs: workout.thangs.map((t, i) => generatedThang(t, thangOn(i))),
    });
    router.push("/workouts/new?generated=1");
  }

  return (
    <section className="card">
      <header className="flex flex-col gap-1">
        <h1 className="card-title">Generate workout</h1>
        <p className="text-sm text-muted">
          Choose {MIN_TAGS} to {MAX_TAGS} tags from the Exicon, and Rocket puts
          a Warm-o-rama and thangs together from them at random.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <ExiconFilterControls
          filters={filters}
          onChange={() => setWorkout(null)}
        />
        <p className="text-sm text-ink-soft">
          {filters.tags.length === 0
            ? `Choose ${MIN_TAGS} to ${MAX_TAGS} tags.`
            : `${filters.tags.join(", ")}${
                filters.tags.length < MIN_TAGS
                  ? `: choose ${MIN_TAGS - filters.tags.length} more.`
                  : filters.tags.length === MAX_TAGS
                    ? ` (that's the most).`
                    : ""
              }`}
        </p>
      </div>

      {library.error ? (
        <p className="text-sm text-accent">{library.error}</p>
      ) : (
        <button
          type="button"
          disabled={!enough || library.loading}
          onClick={generate}
          className="btn w-full disabled:opacity-50"
        >
          <SparkleIcon />
          {library.loading
            ? "Loading the Exicon…"
            : workout
              ? "Generate again"
              : "Generate"}
        </button>
      )}

      {workout && (
        <div className="flex flex-col gap-4" aria-live="polite">
          {!workout.warmup.items.length && !workout.thangs.length ? (
            <p className="panel px-3 py-8 text-center text-muted">
              Nothing in the Exicon matches those. Try other tags or sources.
            </p>
          ) : (
            <>
              {/* Every section's descriptions at once; a dash when some are on and some aren't. */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-line-strong bg-surface-raised px-4 py-3">
                <TriCheckbox
                  checked={allOn}
                  partial={someOn && !allOn}
                  onChange={setAll}
                  label={
                    <span className="font-medium text-ink">
                      Show descriptions
                    </span>
                  }
                />
                <span className="text-xs text-muted">
                  {allOn ? "All sections" : someOn ? "Some sections" : "None"}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 px-1">
                  <h2 className="text-lg font-semibold tracking-tight text-ink">
                    Warm-o-rama
                  </h2>
                  <SectionToggle
                    on={descriptions.warmup}
                    onChange={(on) =>
                      setDescriptions((d) => ({ ...d, warmup: on }))
                    }
                  />
                </div>
                <div className="panel p-4">
                  {workout.warmup.items.length ? (
                    <Items
                      section={workout.warmup}
                      descriptions={descriptions.warmup}
                    />
                  ) : (
                    <p className="text-sm text-muted">
                      No warm-up exercises match.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="px-1 text-lg font-semibold tracking-tight text-ink">
                  The Thang
                </h2>
                <ol className="flex flex-col gap-3">
                  {workout.thangs.map((thang, index) => (
                    <li key={index} className="panel flex flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex flex-col items-start gap-1.5">
                          <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                            Thang {index + 1}
                            {thang.routine && " · Routine"}
                          </span>
                          {thang.timer && (
                            <span className="status text-xs">
                              {timerLabel(thang.timer)}
                            </span>
                          )}
                        </span>
                        <SectionToggle
                          on={thangOn(index)}
                          onChange={(on) =>
                            setDescriptions((d) => {
                              const thangs = workout.thangs.map((_, i) =>
                                i === index ? on : (d.thangs[i] ?? d.warmup),
                              );
                              return { ...d, thangs };
                            })
                          }
                        />
                      </div>
                      {thang.heading && (
                        <p className="text-sm text-ink-soft">{thang.heading}</p>
                      )}
                      <Items section={thang} descriptions={thangOn(index)} />
                    </li>
                  ))}
                </ol>
              </div>

              <button type="button" onClick={create} className="btn w-full">
                <ArrowIcon />
                Create workout from these
              </button>
              <p className="-mt-2 text-center text-xs text-muted">
                Descriptions shown are added to the workout too.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** A section's "Descriptions" checkbox. */
function SectionToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <TriCheckbox
      checked={on}
      onChange={onChange}
      label={<span className="text-sm text-ink-soft">Descriptions</span>}
    />
  );
}

/** A section's exercises: each name and count, with its description under it when shown. */
function Items({
  section,
  descriptions,
}: {
  section: GeneratedSection;
  descriptions: boolean;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {section.items.map((item, index) => (
        <li key={index} className="flex flex-col gap-0.5">
          <span className="font-semibold text-ink">
            {item.name}
            {item.reps ? (
              <span className="ml-1.5 text-accent tabular-nums">
                x {item.reps}
              </span>
            ) : null}
          </span>
          {descriptions && item.description.trim() && (
            <span className="text-sm leading-relaxed text-muted">
              {item.description.replace(/\s+/g, " ").trim()}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
