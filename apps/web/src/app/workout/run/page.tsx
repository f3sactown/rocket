"use client";

import { backblastParts, termsFor, type Workout } from "@rocket/core";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SignedIn, type CurrentUser } from "@/components/auth-provider";
import { ThangTimer } from "@/components/thang-timer";
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
  const terms = termsFor(user.language);
  // Where and when, as at the top of the copied workout.
  const where = backblastParts(
    { ...workout, title: "", notes: "", thang: "", introduction: "" },
    user.language,
  )[0]!.text;
  const thangs = workout.thangs?.length
    ? workout.thangs
    : workout.thang
      ? [{ text: workout.thang }]
      : [];
  const sizeClass = SIZES.find((s) => s.value === size)!.className;
  const section = (title: string, text: string | undefined) =>
    text?.trim() && (
      <section key={title} className="flex flex-col gap-1">
        <h2 className="text-[0.7em] font-semibold tracking-wider text-accent uppercase">
          {title}
        </h2>
        <p className="leading-relaxed whitespace-pre-wrap">{text.trim()}</p>
      </section>
    );

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
      <div className={`flex flex-col gap-6 text-ink ${sizeClass}`}>
        <p className="leading-relaxed whitespace-pre-wrap text-ink-soft">
          {where}
        </p>
        {section("Introduction", workout.introduction)}
        {section(terms.warmup, workout.warmup)}
        {thangs.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-[0.7em] font-semibold tracking-wider text-accent uppercase">
              {terms.thang}
            </h2>
            {thangs.map((thang, index) => (
              <div key={index} className="flex flex-col gap-2">
                {thangs.length > 1 && (
                  <h3 className="text-[0.8em] font-semibold text-ink-soft">
                    Thang {index + 1}
                  </h3>
                )}
                {thang.text.trim() && (
                  <p className="leading-relaxed whitespace-pre-wrap">
                    {thang.text.trim()}
                  </p>
                )}
                {thang.seconds ? <ThangTimer seconds={thang.seconds} /> : null}
              </div>
            ))}
          </section>
        )}
        {section("Announcements", workout.announcements)}
        {section("Words of Wisdom", workout.wordsOfWisdom)}
      </div>
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
