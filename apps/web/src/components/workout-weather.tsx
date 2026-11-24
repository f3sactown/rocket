"use client";

import {
  describeWeather,
  useWorkoutWeather,
  WEATHER_CREDIT,
} from "@/lib/weather";

/**
 * A workout's forecast at its AO for when it starts (from a week ahead), or once its day is past,
 * what the weather was. Nothing when there's none to give.
 */
export function WorkoutWeather({
  workout,
  className = "",
  scaled = false,
}: {
  workout: { address?: string; date?: string; time?: string };
  className?: string;
  /** Sized to the text around it (Run workout's text size), rather than fixed small. */
  scaled?: boolean;
}) {
  const found = useWorkoutWeather(workout);
  if (!found) return null;
  return (
    <p
      data-weather
      className={`flex flex-col gap-0.5 ${scaled ? "text-[0.875em]" : "text-sm"} ${className}`}
    >
      <span className="text-ink-soft">
        {/* A forecast says so; what the weather was needs no label. */}
        {!found.past && (
          <span className="font-medium text-ink">Forecast: </span>
        )}
        {describeWeather(found.weather)}
      </span>
      <a
        href={WEATHER_CREDIT.url}
        target="_blank"
        rel="noreferrer"
        className={`self-start text-muted hover:text-ink ${scaled ? "text-[0.85em]" : "text-xs"}`}
      >
        Weather by Open-Meteo
      </a>
    </p>
  );
}
