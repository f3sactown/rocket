"use client";

import { useEffect, useRef, useState } from "react";
import {
  daysFromToday,
  describeWeather,
  WEATHER_CREDIT,
  workoutWeather,
} from "@/lib/weather";

/**
 * A backblast's Conditions: the weather at the AO when the workout ran, filled in on its own once
 * the workout's day has come (when it's blank), and changeable. "Use the weather at the AO" fills
 * it in again.
 */
export function ConditionsField({
  value,
  onChange,
  address,
  date,
  time,
}: {
  value: string;
  onChange: (value: string) => void;
  address?: string;
  date?: string;
  time?: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "none">("idle");
  // Filled in on its own once for each AO, date and time, so clearing it keeps it clear.
  const tried = useRef<string | null>(null);
  const key = `${address}|${date}|${time}`;
  const ready = !!address?.trim() && !!date && daysFromToday(date) <= 0;

  async function fill() {
    setState("busy");
    const weather = await workoutWeather({ address, date, time, past: true });
    if (weather) {
      onChange(describeWeather(weather));
      setState("idle");
    } else setState("none");
  }

  useEffect(() => {
    if (!ready || value.trim() || tried.current === key) return;
    tried.current = key;
    void fill();
    // Only when the AO, date or time change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);

  return (
    // Not a <label>: tapping its title would press the button inside.
    <div className="label flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-3">
        Conditions
        {ready && (
          <button
            type="button"
            disabled={state === "busy"}
            onClick={fill}
            className="link text-xs font-normal normal-case"
          >
            {state === "busy" ? "Looking it up…" : "Use the weather at the AO"}
          </button>
        )}
      </span>
      <input
        aria-label="Conditions"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="48°F, light rain"
        className="input text-base"
      />
      <span className="text-xs font-normal text-muted normal-case">
        {state === "none" ? (
          "No weather for this AO and time. Type it in, if you like."
        ) : !address?.trim() ? (
          "The weather fills in for an AO from your region's list."
        ) : !ready ? (
          "Fills in with the weather at the AO once the workout's day comes."
        ) : (
          <>
            From the AO&apos;s weather when it started.{" "}
            <a
              href={WEATHER_CREDIT.url}
              target="_blank"
              rel="noreferrer"
              className="link"
            >
              {WEATHER_CREDIT.text}
            </a>
          </>
        )}
      </span>
    </div>
  );
}
