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
}: {
  workout: { address?: string; date?: string; time?: string };
  className?: string;
}) {
  const found = useWorkoutWeather(workout);
  if (!found) return null;
  return (
    <p
      data-weather
      className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm ${className}`}
    >
      <span className="text-ink-soft">
        <span className="font-medium text-ink">
          {found.past ? "Weather" : "Forecast"}:
        </span>{" "}
        {describeWeather(found.weather)}
      </span>
      <a
        href={WEATHER_CREDIT.url}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-muted hover:text-ink"
      >
        Open-Meteo
      </a>
    </p>
  );
}
