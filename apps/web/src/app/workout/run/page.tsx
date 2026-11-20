"use client";

import { Loading, NotFound } from "@/components/not-found";
import { BackblastNotYet } from "@/components/backblast-not-yet";
import { isUpcoming } from "@/lib/backblast-list";

import { backblastParts, termsFor, type Workout } from "@rocket/core";
import Link from "next/link";
import { Linkify } from "@/components/linkify";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  useTerms,
  SignedIn,
  type CurrentUser,
} from "@/components/auth-provider";
import { ArrowIcon } from "@/components/icons";
import { ActiveTimer, ThangTimer } from "@/components/thang-timer";
import { WorkoutWeather } from "@/components/workout-weather";
import { WrapUpWarning } from "@/components/wrap-up-warning";
import { fromWorkoutRow, loadWorkoutNotes, workoutById } from "@/lib/backblast";
import { isOffline } from "@/lib/connection";
import {
  backupKey,
  newBackupKey,
  ownedBy,
  readBackup,
} from "@/lib/local-drafts";
import { readPocket } from "@/lib/pocket";
import { createClient } from "@/lib/supabase/client";
import { setVisibility } from "@/lib/workout-social";

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
  const params = useSearchParams();
  const id = params.get("id");
  // A new workout written offline, not in Rocket yet: run from the copy kept on this phone.
  const local = params.get("local");
  // Back to it: its page, or the form it's being written in.
  const backHref = local ? `/workouts/new?local=${local}` : `/workout?id=${id}`;
  const [size, setSize] = useState<Size>(savedSize);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  // The timer last started and how to pause it, so starting another pauses it.
  const runningTimer = useRef<{ id: string; pause: () => void } | null>(null);
  // Where to go once the "make it public?" question is answered.
  const [leaving, setLeaving] = useState<string | null>(null);
  // Answered (or leaving after answering): go without asking again.
  const asked = useRef(false);
  const router = useRouter();
  // Your backblasts from this workout, to open the one for this run if it's started.
  const [backblasts, setBackblasts] = useState<
    { id: string; status: string; date: string | null }[]
  >([]);
  const [result, setResult] = useState<{
    workout: Workout | null;
    /** Whether it's your workout; only its Q writes the backblast. */
    mine?: boolean;
    /** Your finished workout, kept private: on leaving, you're asked to make it public. */
    privateFinished?: boolean;
    error?: string;
  } | null>(null);

  // Leaving the run of your finished private workout, any way (its buttons, the menu, any link,
  // or back), first asks whether to make it public. Closing the app can't be asked about.
  const privateFinished = !!result?.privateFinished;
  useEffect(() => {
    if (!privateFinished) return;
    asked.current = false;
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    // A link to another page: held until the question's answered.
    const onClick = (event: MouseEvent) => {
      if (asked.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank")
        return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      const path = url.pathname.startsWith(base)
        ? url.pathname.slice(base.length) || "/"
        : url.pathname;
      setLeaving(path + url.search);
    };
    // Back: an extra step in the history (the same page) catches it, and asks.
    window.history.pushState(window.history.state, "", window.location.href);
    const onBack = () => {
      if (asked.current) return;
      window.history.pushState(window.history.state, "", window.location.href);
      setLeaving(BACK);
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onBack);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onBack);
    };
  }, [privateFinished]);

  useEffect(() => {
    // What's typed and kept on this phone: the newest, while offline.
    const onPhone = (key: string) => {
      const backup = readBackup(key);
      return backup && ownedBy(backup, user.id) ? backup.content : null;
    };
    if (local) {
      const workout = onPhone(newBackupKey("workout", local));
      setResult(
        workout
          ? { workout, mine: true }
          : { workout: null, error: "Not kept on this phone" },
      );
      return;
    }
    if (!id) return;
    workoutById(id).then(async ({ data, error }) => {
      const typed = isOffline() ? onPhone(backupKey("workout", id)) : null;
      setResult({
        workout:
          typed ??
          (data &&
            fromWorkoutRow(
              data,
              data.author_id === user.id ? await loadWorkoutNotes(data.id) : "",
            )),
        mine: !!typed || data?.author_id === user.id,
        privateFinished:
          data?.author_id === user.id &&
          data.status === "published" &&
          data.visibility === "private",
        error: typed ? undefined : error?.message,
      });
    });
  }, [id, local, user.id]);

  useEffect(() => {
    if (!id) return;
    if (isOffline()) {
      void readPocket().then((pocket) =>
        setBackblasts(
          (pocket?.backblasts ?? [])
            .filter((b) => b.workout_id === id)
            .map(({ id, status, date }) => ({ id, status, date })),
        ),
      );
      return;
    }
    createClient()
      .from("backblasts")
      .select("id, status, date")
      .eq("workout_id", id)
      .eq("author_id", user.id)
      .then(({ data }) => setBackblasts(data ?? []));
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

  if ((id || local) && !result) return <Loading />;
  if (!result?.workout)
    return <NotFound what="workout" error={result?.error} />;

  const { workout } = result;
  const terms = termsFor(user.language);
  // Where and when, as at the top of the copied workout.
  const where =
    backblastParts(
      {
        ...workout,
        title: "",
        notes: "",
        thang: "",
        introduction: "",
      },
      user.language,
    )[0]?.text ?? "";
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
        <p className="leading-relaxed whitespace-pre-wrap">
          <Linkify text={text.trim()} />
        </p>
      </section>
    );

  return (
    <ActiveTimer.Provider
      value={{
        active: activeTimer,
        setActive: (timerId, pause) => {
          const before = runningTimer.current;
          if (before && before.id !== timerId) before.pause();
          runningTimer.current = { id: timerId, pause };
          setActiveTimer(timerId);
        },
      }}
    >
      <article className="card">
        <WrapUpWarning date={workout.date} time={workout.time} />
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Link href={backHref} className="link text-sm">
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
            <Linkify text={where} />
          </p>
          <WorkoutWeather workout={workout} className="-mt-4" />
          {section("Introduction", workout.introduction)}
          {section(terms.warmup, workout.warmup)}
          {thangs.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-[0.7em] font-semibold tracking-wider text-accent uppercase">
                {terms.thang}
              </h2>
              {thangs.map((thang, index) => (
                <div key={index} className="flex flex-col gap-2">
                  {thang.text.trim() && (
                    <p className="leading-relaxed whitespace-pre-wrap">
                      <Linkify text={thang.text.trim()} />
                    </p>
                  )}
                  {thang.music && (
                    <a
                      href={thang.music.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn gap-2 self-start px-4 py-2 text-base"
                    >
                      <span aria-hidden>♫</span>
                      {thang.music.title || "Play music"}
                      <span aria-hidden>♫</span>
                    </a>
                  )}
                  {thang.timer && (
                    <ThangTimer
                      timer={thang.timer}
                      // Named by its first line in the pinned copy, since thangs aren't numbered.
                      label={thang.text.trim().split("\n")[0] || terms.thang}
                    />
                  )}
                </div>
              ))}
            </section>
          )}
          {section("Notes", workout.notes)}
          {section(terms.wordsOfWisdom, workout.wordsOfWisdom)}
        </div>
        <div className="flex items-start gap-2">
          {/* Done running it: back to Home. */}
          <Link href="/" className="btn shrink-0 px-7">
            Close
          </Link>
          {/* Its backblast once it's in Rocket (not for one only on this phone). */}
          {result.mine &&
            !local &&
            (() => {
              const existing = backblasts[0];
              if (!existing && isUpcoming(workout.date))
                return (
                  <div className="flex-1">
                    <BackblastNotYet date={workout.date!} />
                  </div>
                );
              const href = existing
                ? existing.status === "draft"
                  ? `/backblasts/edit?id=${existing.id}`
                  : `/backblast?id=${existing.id}`
                : `/backblasts/new?workout=${id}`;
              return (
                <Link href={href} className="btn flex-1">
                  <ArrowIcon />
                  {existing
                    ? existing.status === "draft"
                      ? "Continue backblast"
                      : "Open backblast"
                    : "Create backblast"}
                </Link>
              );
            })()}
        </div>
      </article>
      {leaving && (
        <MakePublic
          workoutId={id!}
          onDone={() => {
            const where = leaving;
            setLeaving(null);
            asked.current = true;
            // Back (button or gesture): past the extra step this page added, to where it was.
            if (where === BACK) window.history.go(-2);
            else router.push(where);
          }}
        />
      )}
    </ActiveTimer.Provider>
  );
}

/** Leaving by going back, rather than to a page. */
const BACK = "back";

/** After running a private workout: make it public so other PAX can see, like and reuse it? */
function MakePublic({
  workoutId,
  onDone,
}: {
  workoutId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reuse = useTerms().reuse.one;
  const chip =
    "rounded-full border border-line-strong px-3 py-1.5 text-sm font-medium text-ink transition hover:border-accent/60 disabled:opacity-50";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="make-public-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-line-strong bg-surface-raised p-5 shadow-2xl">
        <h2 id="make-public-title" className="text-lg font-semibold text-ink">
          Make this workout public?
        </h2>
        <p className="text-sm text-ink-soft">
          It&apos;s private, so only you can see it. Public, other PAX can see
          it on Discover and your PAX profile, and like and {reuse} it.
        </p>
        {error && <p className="text-sm text-accent">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await setVisibility(workoutId, "public");
                onDone();
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
            className={chip}
          >
            Make public
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDone}
            className={chip}
          >
            Keep private
          </button>
        </div>
      </div>
    </div>
  );
}
