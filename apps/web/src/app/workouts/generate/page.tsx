"use client";

import {
  generateWorkout,
  thangText,
  timerLabel,
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
  const enough =
    filters.tags.length >= MIN_TAGS && filters.tags.length <= MAX_TAGS;

  function generate() {
    setWorkout(generateWorkout(entries.filter(filters.inScope), filters.tags));
  }

  function create() {
    if (!workout) return;
    keepGenerated(workout);
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
          {!workout.warmup && !workout.thangs.length ? (
            <p className="panel px-3 py-8 text-center text-muted">
              Nothing in the Exicon matches those. Try other tags or sources.
            </p>
          ) : (
            <>
              <Part title="Warm-o-rama">
                <p className="panel p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
                  {workout.warmup || "No warm-up exercises match."}
                </p>
              </Part>
              <Part title="The Thang">
                <ol className="flex flex-col gap-3">
                  {workout.thangs.map((thang, index) => (
                    <li key={index} className="panel flex flex-col gap-2 p-4">
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                          Thang {index + 1}
                        </span>
                        {thang.timer && (
                          <span className="status text-xs">
                            {timerLabel(thang.timer)}
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
                        {thangText([{ ...thang, timer: undefined }])}
                      </span>
                    </li>
                  ))}
                </ol>
              </Part>
              <button type="button" onClick={create} className="btn w-full">
                <ArrowIcon />
                Create workout from these
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Part({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="px-1 text-lg font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {children}
    </div>
  );
}
