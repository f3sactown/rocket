import { describe, expect, it } from "vitest";
// The weather helpers live with the Edge Function that also uses them; they have no imports, so
// they're tested here.
import {
  describeWeather,
  hourKey,
  placeKey,
  streetAddress,
  weatherAt,
  weatherUrl,
  type Weather,
} from "../../../supabase/functions/_shared/weather";

const base: Weather = {
  temperature: 48.4,
  feelsLike: 46,
  humidity: 70,
  wind: 3,
  chance: 10,
  code: 3,
};

describe("addresses", () => {
  it("keys an address the same however it's spaced or cased", () => {
    expect(placeKey("  Oki Park -  2715 Wissemann Dr ")).toBe(
      "oki park - 2715 wissemann dr",
    );
  });

  it("finds the street address after the place's name", () => {
    expect(
      streetAddress("Oki Park - 2715 Wissemann Dr, Sacramento, CA 95826"),
    ).toBe("2715 Wissemann Dr, Sacramento, CA 95826");
    expect(streetAddress("2715 Wissemann Dr, Sacramento, CA")).toBe(
      "2715 Wissemann Dr, Sacramento, CA",
    );
    expect(streetAddress("Oki Park")).toBe("Oki Park");
  });
});

describe("describeWeather", () => {
  it("gives the temperature and conditions", () => {
    expect(describeWeather(base)).toBe("48°F, overcast");
  });

  it("adds what it feels like, the wind and the chance of rain when they matter", () => {
    expect(
      describeWeather({ ...base, feelsLike: 41, wind: 12.4, chance: 60 }),
    ).toBe("48°F (feels like 41°F), overcast, wind 12 mph, 60% chance of rain");
  });

  it("leaves out the chance of rain when it's raining", () => {
    expect(describeWeather({ ...base, code: 61, chance: 90 })).toBe(
      "48°F, light rain",
    );
  });

  it("adds the humidity on a muggy morning", () => {
    expect(
      describeWeather({
        ...base,
        temperature: 72,
        feelsLike: 74,
        humidity: 90,
      }),
    ).toBe("72°F, overcast, 90% humidity");
  });

  it("leaves out the chance of rain for past weather", () => {
    expect(describeWeather({ ...base, chance: null })).toBe("48°F, overcast");
  });
});

describe("weatherUrl", () => {
  it("asks for the day, in °F and mph, in the place's own time", () => {
    const url = weatherUrl(38.55, -121.39, "2026-11-20", "2026-11-19")!;
    expect(url).toMatch(/^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
    expect(url).toContain("latitude=38.5500&longitude=-121.3900");
    expect(url).toContain("start_date=2026-11-20&end_date=2026-11-20");
    expect(url).toContain("temperature_unit=fahrenheit");
    expect(url).toContain("wind_speed_unit=mph");
    expect(url).toContain("timezone=auto");
  });

  it("has nothing too far ahead", () => {
    expect(weatherUrl(38.55, -121.39, "2026-12-30", "2026-11-19")).toBeNull();
  });

  it("asks the archive for older dates", () => {
    expect(weatherUrl(38.55, -121.39, "2026-01-02", "2026-11-19")).toMatch(
      /^https:\/\/historical-forecast-api\.open-meteo\.com\//,
    );
  });
});

describe("weatherAt", () => {
  const response = {
    hourly: {
      time: ["2026-11-20T05:00", "2026-11-20T06:00"],
      temperature_2m: [47.9, 49],
      apparent_temperature: [43, 45],
      relative_humidity_2m: [88, 85],
      precipitation_probability: [40, 30],
      weather_code: [2, 3],
      wind_speed_10m: [6, 7],
    },
  };

  it("finds the hour nearest the start", () => {
    expect(hourKey("2026-11-20", 5 * 60 + 15)).toBe("2026-11-20T05:00");
    expect(hourKey("2026-11-20", 5 * 60 + 45)).toBe("2026-11-20T06:00");
    expect(weatherAt(response, "2026-11-20T05:00")).toEqual({
      temperature: 47.9,
      feelsLike: 43,
      humidity: 88,
      wind: 6,
      chance: 40,
      code: 2,
    });
  });

  it("has nothing for an hour it doesn't have, or a bad answer", () => {
    expect(weatherAt(response, "2026-11-20T09:00")).toBeNull();
    expect(weatherAt({ error: true }, "2026-11-20T05:00")).toBeNull();
    expect(weatherAt(null, "2026-11-20T05:00")).toBeNull();
  });
});
