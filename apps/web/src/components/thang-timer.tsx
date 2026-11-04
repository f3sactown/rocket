"use client";

import { formatTimer, timerLabel, timerPhases, type Timer } from "@rocket/core";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

/** A short beep, higher for the end, where the browser allows sound. */
function beep(final: boolean) {
  try {
    const AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof window.AudioContext })
        .webkitAudioContext;
    const audio = new AudioContext();
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    tone.frequency.value = final ? 880 : 660;
    const length = final ? 0.8 : 0.35;
    volume.gain.setValueAtTime(0.3, audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + length);
    tone.connect(volume).connect(audio.destination);
    tone.start();
    tone.stop(audio.currentTime + length);
  } catch {
    // No sound; the screen still shows what's happening.
  }
  navigator.vibrate?.(final ? [300, 150, 300] : 200);
}

/**
 * The Run workout screen's timer for one thang. A stopwatch counts up; the others count down
 * through their stretches (each round's work and rest, each EMOM minute), beeping as each one
 * ends and when the whole timer is done.
 */
/**
 * Which timer on the page was used last, so only that one is pinned to the top when it's
 * scrolled out of view.
 */
export const ActiveTimer = createContext<{
  active: string | null;
  setActive: (id: string) => void;
}>({ active: null, setActive: () => {} });

export function ThangTimer({ timer, label }: { timer: Timer; label?: string }) {
  const id = useId();
  const { active, setActive } = useContext(ActiveTimer);
  const box = useRef<HTMLDivElement>(null);
  // Whether the timer's box is on screen; when it isn't, a copy is pinned to the top.
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(entry!.isIntersecting),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Keyed on the settings, so the list (and the ticking below) isn't rebuilt every second.
  const key = JSON.stringify(timer);
  const phases = useMemo(() => timerPhases(JSON.parse(key) as Timer), [key]);
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(0);
  // Seconds left in the current stretch, or (for a stopwatch) seconds so far.
  const [count, setCount] = useState(phases[0]?.seconds ?? 0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  // When the current stretch ends (or when the stopwatch started), so pauses in the page don't
  // make it drift.
  const mark = useRef(0);

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      if (timer.type === "stopwatch") {
        setCount(Math.floor((Date.now() - mark.current) / 1000));
        return;
      }
      const left = Math.max(0, Math.ceil((mark.current - Date.now()) / 1000));
      setCount(left);
      if (left > 0) return;
      const next = phaseRef.current + 1;
      if (next >= phases.length) {
        setRunning(false);
        setDone(true);
        beep(true);
        return;
      }
      beep(false);
      phaseRef.current = next;
      mark.current = Date.now() + phases[next]!.seconds * 1000;
      setPhase(next);
      setCount(phases[next]!.seconds);
    }, 250);
    return () => clearInterval(tick);
  }, [running, timer.type, phases]);

  function start() {
    setActive(id);
    if (done) return reset(true);
    mark.current =
      timer.type === "stopwatch"
        ? Date.now() - count * 1000
        : Date.now() + count * 1000;
    setRunning(true);
  }

  function reset(andStart = false) {
    setDone(false);
    phaseRef.current = 0;
    setPhase(0);
    const first = timer.type === "stopwatch" ? 0 : (phases[0]?.seconds ?? 0);
    setCount(first);
    mark.current =
      timer.type === "stopwatch" ? Date.now() : Date.now() + first * 1000;
    setRunning(andStart);
  }

  const current = phases[phase];
  const fresh =
    !running &&
    !done &&
    phase === 0 &&
    count === (timer.type === "stopwatch" ? 0 : (phases[0]?.seconds ?? 0));
  const pause = () => setRunning(false);
  const pinned = active === id && !onScreen && !fresh;
  const controls = (
    <span className="ml-auto flex gap-2 text-base">
      {running ? (
        <button type="button" onClick={pause} className="btn px-4 py-2">
          {timer.type === "stopwatch" ? "Stop" : "Pause"}
        </button>
      ) : (
        <button type="button" onClick={start} className="btn px-4 py-2">
          {done ? "Again" : fresh ? "Start" : "Resume"}
        </button>
      )}
      {!fresh && !done && (
        <button type="button" onClick={() => reset()} className="link px-2">
          Reset
        </button>
      )}
    </span>
  );

  return (
    <>
      {pinned && (
        // The timer in use, pinned to the top while its box is scrolled out of view.
        <div
          role="region"
          aria-label="Current timer"
          className={`fixed inset-x-3 top-3 z-30 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border px-4 py-2.5 text-base shadow-xl backdrop-blur ${
            done
              ? "border-accent bg-accent-soft"
              : "border-line-strong bg-surface-raised/95"
          }`}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-xs text-muted">
              {label ?? timerLabel(timer)}
              {current?.label && !done && ` · ${current.label}`}
            </span>
            <span className="font-mono text-2xl leading-tight text-ink tabular-nums">
              {done ? "Time!" : formatTimer(count)}
            </span>
          </span>
          {controls}
        </div>
      )}
      <div
        ref={box}
        className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 ${
          done
            ? "border-accent bg-accent-soft"
            : current?.rest
              ? "border-line-strong bg-hover"
              : "border-line"
        }`}
      >
        <span className="text-[0.6em] font-medium text-muted">
          {timerLabel(timer)}
          {current?.label && !done && (
            <span className="text-ink-soft"> · {current.label}</span>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <span
            role="timer"
            aria-live={done ? "assertive" : "off"}
            className="font-mono text-[1.6em] leading-none text-ink tabular-nums"
          >
            {done ? "Time!" : formatTimer(count)}
          </span>
          {controls}
        </div>
      </div>
    </>
  );
}
