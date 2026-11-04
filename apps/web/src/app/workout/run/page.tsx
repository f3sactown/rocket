"use client";

import { formatBackblast, type Workout } from "@rocket/core";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { fromWorkoutRow, loadWorkoutNotes } from "@/lib/backblast";
import { createClient } from "@/lib/supabase/client";

export default function RunWorkoutPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <SignedIn>{(user) => <RunWorkout user={user} />}</SignedIn>
    </Suspense>
  );
}

const SIZES = [
  { value: "normal", label: "Normal", className: "text-base" },
  { value: "large", label: "Large", className: "text-xl" },
  { value: "xl", label: "Extra large", className: "text-3xl" },
] as const;

type Size = (typeof SIZES)[number]["value"];

const SIZE_KEY = "rocket-run-size";

function savedSize(): Size {
  try {
    const value = localStorage.getItem(SIZE_KEY);
    return SIZES.some((s) => s.value === value) ? (value as Size) : "normal";
  } catch {
    return "normal";
  }
}

/**
 * The workout to read from while leading it: the whole plan in a choice of text sizes, with the
 * Q's private notes at the end. The screen is kept awake while it's open, where the browser
 * allows.
 */
function RunWorkout({ user }: { user: CurrentUser }) {
  const id = useSearchParams().get("id");
  const [size, setSize] = useState<Size>(savedSize);
  const [result, setResult] = useState<{
    workout: Workout | null;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    createClient()
      .from("workouts")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(async ({ data, error }) =>
        setResult({
          workout:
            data &&
            fromWorkoutRow(
              data,
              data.author_id === user.id ? await loadWorkoutNotes(data.id) : "",
            ),
          error: error?.message,
        }),
      );
  }, [id, user.id]);

  // Keep the screen on while the workout is being run.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = () =>
      (
        navigator as Navigator & {
          wakeLock?: { request: (type: "screen") => Promise<typeof lock> };
        }
      ).wakeLock
        ?.request("screen")
        .then((l) => (lock = l))
        .catch(() => {});
    request();
    // The lock is dropped when the page is hidden; take it again on return.
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  function choose(value: Size) {
    setSize(value);
    try {
      localStorage.setItem(SIZE_KEY, value);
    } catch {
      // Not remembered, but still applied.
    }
  }

  if (id && !result) return <div className="card h-96 animate-pulse" />;
  if (!result?.workout)
    return (
      <section className="card">
        <h1 className="card-title">Workout not found</h1>
        {result?.error && <p className="text-accent">{result.error}</p>}
      </section>
    );

  const { workout } = result;
  const text = formatBackblast({ ...workout, notes: "" }, user.language);
  const sizeClass = SIZES.find((s) => s.value === size)!.className;

  return (
    <article className="card">
      <div className="sticky top-2 z-10 -mx-1 flex flex-col gap-3 rounded-2xl bg-surface/95 p-1 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/workout?id=${id}`} className="link text-sm">
            ← Workout
          </Link>
          <span className="status text-sm">Running</span>
        </div>
        <div
          role="radiogroup"
          aria-label="Text size"
          className="grid grid-cols-3 gap-1 rounded-full border border-line bg-panel p-1"
        >
          {SIZES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={size === option.value}
              onClick={() => choose(option.value)}
              className={`rounded-full px-2 py-1.5 text-sm font-medium transition-colors ${
                size === option.value
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <h1 className="card-title">{workout.title}</h1>
      <pre
        className={`font-sans leading-relaxed whitespace-pre-wrap text-ink ${sizeClass}`}
      >
        {text}
      </pre>
      {workout.notes && (
        <section className="flex flex-col gap-2 rounded-2xl border border-line p-4">
          <h2 className="text-xs font-semibold tracking-wider text-accent uppercase">
            Your notes · only you see these
          </h2>
          <p
            className={`leading-relaxed whitespace-pre-wrap text-ink-soft ${sizeClass}`}
          >
            {workout.notes}
          </p>
        </section>
      )}
    </article>
  );
}
