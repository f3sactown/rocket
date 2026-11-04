"use client";

import { formatTimer } from "@rocket/core";
import { useEffect, useRef, useState } from "react";

/** A short beep when a timer runs out, where the browser allows sound. */
function beep() {
  try {
    const AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof window.AudioContext })
        .webkitAudioContext;
    const audio = new AudioContext();
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    tone.frequency.value = 880;
    volume.gain.setValueAtTime(0.3, audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.8);
    tone.connect(volume).connect(audio.destination);
    tone.start();
    tone.stop(audio.currentTime + 0.8);
  } catch {
    // No sound; the screen still shows the time is up.
  }
}

/**
 * A countdown for one thang: start, pause and reset. When it reaches zero it beeps and vibrates
 * (where the device allows) and says so.
 */
export function ThangTimer({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  // When the current run ends, so the countdown stays right if the page is briefly paused.
  const endsAt = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil(((endsAt.current ?? Date.now()) - Date.now()) / 1000),
      );
      setLeft(remaining);
      if (remaining === 0) {
        setRunning(false);
        beep();
        navigator.vibrate?.([300, 150, 300]);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [running]);

  function start() {
    const from = left === 0 ? seconds : left;
    setLeft(from);
    endsAt.current = Date.now() + from * 1000;
    setRunning(true);
  }

  const done = left === 0;
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${
        done ? "border-accent bg-accent-soft" : "border-line"
      }`}
    >
      <span
        role="timer"
        aria-live={done ? "assertive" : "off"}
        className="font-mono text-[1.6em] leading-none text-ink tabular-nums"
      >
        {done ? "Time!" : formatTimer(left)}
      </span>
      <span className="ml-auto flex gap-2 text-base">
        {running ? (
          <button
            type="button"
            onClick={() => setRunning(false)}
            className="btn px-4 py-2"
          >
            Pause
          </button>
        ) : (
          <button type="button" onClick={start} className="btn px-4 py-2">
            {done ? "Again" : left < seconds ? "Resume" : "Start"}
          </button>
        )}
        {(left < seconds || running) && !done && (
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setLeft(seconds);
            }}
            className="link px-2"
          >
            Reset
          </button>
        )}
      </span>
    </div>
  );
}
