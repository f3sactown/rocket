/**
 * Weather at an AO for a workout: the forecast before it, and what it was after (for the
 * backblast's Conditions). From Open-Meteo (https://open-meteo.com: free, no key, credited where
 * it's shown), by the AO's coordinates, which the nightly region sync looks up from its address
 * (`place_coordinates`). Used by the app and by the push-reminders function (the day-before
 * reminder), so it has no imports; it's tested in packages/core.
 */

/** The weather at one hour. */
export interface Weather {
  /** °F. */
  temperature: number;
  /** °F, what it feels like with wind and humidity. */
  feelsLike: number;
  /** %. */
  humidity: number;
  /** mph. */
  wind: number;
  /** Chance of rain or snow (%), for a forecast. */
  chance: number | null;
  /** The WMO weather code, see CONDITIONS. */
  code: number;
}

/** How a place's address is kept and looked up: trimmed, single-spaced, lower case. */
export const placeKey = (address: string) =>
  address.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The part of an AO's address a geocoder can find: its street address when it has one after the
 * place's name ("Oki Park - 2715 Wissemann Dr, Sacramento, CA 95826" gives the street address),
 * else all of it.
 */
export function streetAddress(address: string): string {
  const parts = address.split(/\s+[-–—]\s+/).map((p) => p.trim());
  const street = [...parts].reverse().find((p) => /\d/.test(p) && /,/.test(p));
  return (street ?? address).trim();
}

/** What each WMO weather code means, in a few words. */
const CONDITIONS: [number[], string][] = [
  [[0], "clear"],
  [[1], "mostly clear"],
  [[2], "partly cloudy"],
  [[3], "overcast"],
  [[45, 48], "fog"],
  [[51], "light drizzle"],
  [[53, 55], "drizzle"],
  [[56, 57], "freezing drizzle"],
  [[61], "light rain"],
  [[63], "rain"],
  [[65], "heavy rain"],
  [[66, 67], "freezing rain"],
  [[71], "light snow"],
  [[73], "snow"],
  [[75], "heavy snow"],
  [[77], "snow grains"],
  [[80], "light showers"],
  [[81], "showers"],
  [[82], "heavy showers"],
  [[85, 86], "snow showers"],
  [[95], "thunderstorms"],
  [[96, 99], "thunderstorms with hail"],
];

export function condition(code: number): string {
  return CONDITIONS.find(([codes]) => codes.includes(code))?.[1] ?? "";
}

/** Rain or snow is already falling in this code (so no "chance of" is added). */
const wet = (code: number) => code >= 51;

/**
 * The weather in a line, e.g. "48°F (feels like 42°F), light rain, wind 12 mph". A forecast adds
 * the chance of rain when it's worth knowing; muggy mornings add the humidity.
 */
export function describeWeather(weather: Weather): string {
  const t = Math.round(weather.temperature);
  const feels = Math.round(weather.feelsLike);
  const wind = Math.round(weather.wind);
  return [
    `${t}°F${Math.abs(feels - t) >= 5 ? ` (feels like ${feels}°F)` : ""}`,
    condition(weather.code),
    wind >= 5 && `wind ${wind} mph`,
    weather.chance !== null &&
      weather.chance >= 20 &&
      !wet(weather.code) &&
      `${Math.round(weather.chance)}% chance of rain`,
    weather.humidity >= 85 &&
      t >= 65 &&
      `${Math.round(weather.humidity)}% humidity`,
  ]
    .filter(Boolean)
    .join(", ");
}

/** When a workout with no time is taken to start (minutes after midnight): 6am. */
export const DEFAULT_START = 6 * 60;

/** How far ahead a forecast is given (days); the app shows it from a week out. */
export const FORECAST_DAYS = 15;

/** Days from one YYYY-MM-DD date to another. */
const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );

/**
 * Where to ask for the weather at a place on a date (YYYY-MM-DD, local there), or null for one
 * too far ahead. Older than three months comes from Open-Meteo's archive of past forecasts.
 */
export function weatherUrl(
  latitude: number,
  longitude: number,
  date: string,
  today: string,
): string | null {
  const ahead = daysBetween(today, date);
  if (Number.isNaN(ahead) || ahead > FORECAST_DAYS) return null;
  const host =
    ahead < -90
      ? "historical-forecast-api.open-meteo.com"
      : "api.open-meteo.com";
  const params: [string, string][] = [
    ["latitude", latitude.toFixed(4)],
    ["longitude", longitude.toFixed(4)],
    [
      "hourly",
      "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m",
    ],
    ["temperature_unit", "fahrenheit"],
    ["wind_speed_unit", "mph"],
    ["timezone", "auto"],
    ["start_date", date],
    ["end_date", date],
  ];
  return `https://${host}/v1/forecast?${params.map(([k, v]) => `${k}=${v}`).join("&")}`;
}

/** The hour nearest a start time, as Open-Meteo writes it (local time there). */
export function hourKey(date: string, startMinutes: number): string {
  const hour = Math.min(23, Math.round(startMinutes / 60));
  return `${date}T${String(hour).padStart(2, "0")}:00`;
}

/** The weather at one hour from Open-Meteo's answer, or null if it hasn't got it. */
export function weatherAt(response: unknown, hour: string): Weather | null {
  const hourly = (response as { hourly?: Record<string, unknown[]> } | null)
    ?.hourly;
  const times = hourly?.time;
  if (!hourly || !Array.isArray(times)) return null;
  const i = times.indexOf(hour);
  if (i < 0) return null;
  const value = (name: string) => {
    const v = hourly[name]?.[i];
    return typeof v === "number" ? v : null;
  };
  const temperature = value("temperature_2m");
  const code = value("weather_code");
  if (temperature === null || code === null) return null;
  return {
    temperature,
    feelsLike: value("apparent_temperature") ?? temperature,
    humidity: value("relative_humidity_2m") ?? 0,
    wind: value("wind_speed_10m") ?? 0,
    chance: value("precipitation_probability"),
    code,
  };
}

/**
 * The weather at a place for a workout starting then, or null when it can't be had (too far
 * ahead, no connection, or nothing for that hour).
 */
export async function fetchWeather({
  latitude,
  longitude,
  date,
  startMinutes,
  today,
  past,
}: {
  latitude: number;
  longitude: number;
  date: string;
  startMinutes: number | null;
  today: string;
  /** What it was (no chance of rain), rather than a forecast. */
  past?: boolean;
}): Promise<Weather | null> {
  const url = weatherUrl(latitude, longitude, date, today);
  if (!url) return null;
  try {
    // The browser's or Deno's fetch (packages/core, where this is tested, has no DOM types).
    const { fetch } = globalThis as unknown as {
      fetch: (
        url: string,
      ) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
    };
    const response = await fetch(url);
    if (!response.ok) return null;
    const weather = weatherAt(
      await response.json(),
      hourKey(date, startMinutes ?? DEFAULT_START),
    );
    return weather && past ? { ...weather, chance: null } : weather;
  } catch {
    return null;
  }
}

/** Credit for the weather, wherever it's shown. */
export const WEATHER_CREDIT = {
  text: "Weather data by Open-Meteo.com",
  url: "https://open-meteo.com/",
};
