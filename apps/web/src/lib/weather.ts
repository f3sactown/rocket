"use client";

import { useEffect, useState } from "react";
import {
  fetchWeather,
  placeKey,
  type Weather,
} from "../../../../supabase/functions/_shared/weather";
import { workoutTimes } from "../../../../supabase/functions/_shared/reminders";
import { localToday } from "./backblast-list";
import { createClient } from "./supabase/client";

export {
  describeWeather,
  WEATHER_CREDIT,
} from "../../../../supabase/functions/_shared/weather";

/** Each address's coordinates, once looked up (null when Rocket doesn't know where it is). */
const places = new Map<string, Promise<{ lat: number; lng: number } | null>>();

/** Where an AO's address is, from the coordinates the region sync keeps. */
function coordinates(address: string) {
  const key = placeKey(address);
  let found = places.get(key);
  if (!found) {
    found = Promise.resolve(
      createClient()
        .from("place_coordinates")
        .select("latitude, longitude")
        .eq("address", key)
        .maybeSingle(),
    ).then(({ data, error }) => {
      if (error) throw error;
      return data?.latitude != null && data.longitude != null
        ? { lat: data.latitude, lng: data.longitude }
        : null;
    });
    // Not kept when it fails, so it's tried again.
    found.catch(() => places.delete(key));
    places.set(key, found);
  }
  return found;
}

/** The last weather found for each workout, kept on the phone for when there's no connection. */
const KEPT_KEY = "rocket-weather";

function kept(key: string): Weather | null {
  try {
    const all = JSON.parse(localStorage.getItem(KEPT_KEY) ?? "{}") as Record<
      string,
      Weather
    >;
    return all[key] ?? null;
  } catch {
    return null;
  }
}

function keep(key: string, weather: Weather) {
  try {
    const all = JSON.parse(localStorage.getItem(KEPT_KEY) ?? "{}") as Record<
      string,
      Weather
    >;
    all[key] = weather;
    // Only the most recent few.
    const keys = Object.keys(all);
    for (const old of keys.slice(0, Math.max(0, keys.length - 30)))
      delete all[old];
    localStorage.setItem(KEPT_KEY, JSON.stringify(all));
  } catch {
    // Not kept.
  }
}

/**
 * The weather at a workout's AO when it starts: its forecast, or what it was once it's past.
 * Null while it loads, and when there's none (no known address, or too far ahead).
 */
export async function workoutWeather({
  address,
  date,
  time,
  past,
}: {
  address: string | undefined;
  date: string | undefined;
  time: string | undefined;
  past?: boolean;
}): Promise<Weather | null> {
  if (!address?.trim() || !date) return null;
  const key = `${placeKey(address)}|${date}|${time ?? ""}|${past ? "past" : "forecast"}`;
  try {
    const place = await coordinates(address);
    if (place) {
      const weather = await fetchWeather({
        latitude: place.lat,
        longitude: place.lng,
        date,
        startMinutes: workoutTimes(time).start,
        today: localToday(),
        past,
      });
      if (weather) {
        keep(key, weather);
        return weather;
      }
    }
  } catch {
    // No connection: the last one found, if any.
  }
  return kept(key);
}

/** How many days from today a date is (negative for one past). */
export function daysFromToday(date: string): number {
  return Math.round(
    (Date.parse(`${date}T12:00:00`) - Date.parse(`${localToday()}T12:00:00`)) /
      86_400_000,
  );
}

/**
 * A workout's forecast (or, once its day is past, its weather) for its page and Run workout: from
 * a week ahead, and for up to three months after.
 */
export function useWorkoutWeather(
  workout: {
    address?: string;
    date?: string;
    time?: string;
  } | null,
): { weather: Weather; past: boolean } | null {
  const [found, setFound] = useState<{
    key: string;
    weather: Weather;
    past: boolean;
  } | null>(null);
  const address = workout?.address;
  const date = workout?.date;
  const time = workout?.time;
  const key = `${address}|${date}|${time}`;
  useEffect(() => {
    if (!address || !date) return;
    const days = daysFromToday(date);
    if (days > 7 || days < -90) return;
    const past = days < 0;
    let live = true;
    void workoutWeather({ address, date, time, past }).then((weather) => {
      if (live && weather) setFound({ key, weather, past });
    });
    return () => {
      live = false;
    };
  }, [address, date, time, key]);
  return found && found.key === key
    ? { weather: found.weather, past: found.past }
    : null;
}
