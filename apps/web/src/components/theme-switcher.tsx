"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  ACCENT_STORAGE_KEY,
  ACCENTS,
  THEME_STORAGE_KEY,
  type Accent,
  type ThemePreference,
} from "@/lib/theme";

const CHANGE_EVENT = "rocket-appearance-change";
const lightQuery = () => window.matchMedia("(prefers-color-scheme: light)");

/** A per-device preference in localStorage; storing the default removes the key. */
function storedPreference<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
) {
  const read = (): T => {
    try {
      const value = localStorage.getItem(key) as T | null;
      return value && allowed.includes(value) ? value : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (value: T) => {
    try {
      if (value === fallback) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // Storage unavailable (e.g. private mode); the choice still applies to this page.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return { read, write };
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

const themePreference = storedPreference<ThemePreference>(
  THEME_STORAGE_KEY,
  ["light", "dark", "system"],
  "system",
);
const accentPreference = storedPreference<Accent>(
  ACCENT_STORAGE_KEY,
  ACCENTS.map((a) => a.value),
  "f3",
);

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "System",
    icon: (
      <svg
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" />
        <path d="M5.5 14.5h5M8 11.5v3" />
      </svg>
    ),
  },
];

/** Light / Dark / System choice, remembered per device. System follows the OS, live. */
export function ThemeSwitcher() {
  const preference = useSyncExternalStore(
    subscribe,
    themePreference.read,
    () => "system" as const,
  );

  // Apply the resolved theme, and keep following the OS while the choice is "system".
  useEffect(() => {
    const apply = () => {
      const light =
        preference === "light" ||
        (preference === "system" && lightQuery().matches);
      document.documentElement.dataset.theme = light ? "light" : "dark";
    };
    apply();
    if (preference !== "system") return;
    const query = lightQuery();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [preference]);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex gap-1 rounded-full border border-line bg-panel p-1"
    >
      {OPTIONS.map((option) => {
        const selected = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => themePreference.write(option.value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              selected
                ? "bg-surface-raised text-ink shadow-sm [&_svg]:text-accent"
                : "text-muted hover:text-ink"
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Accent color swatches, remembered per device. */
export function AccentPicker() {
  const accent = useSyncExternalStore(
    subscribe,
    accentPreference.read,
    () => "f3" as const,
  );

  useEffect(() => {
    if (accent === "f3") delete document.documentElement.dataset.accent;
    else document.documentElement.dataset.accent = accent;
  }, [accent]);

  return (
    <div
      role="radiogroup"
      aria-label="Accent color"
      className="flex flex-wrap gap-2"
    >
      {ACCENTS.map((option) => {
        const selected = accent === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => accentPreference.write(option.value)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              selected
                ? "border-accent bg-accent-soft text-ink"
                : "border-line text-ink-soft hover:border-line-strong hover:text-ink"
            }`}
          >
            <span
              className="size-3.5 rounded-full"
              style={{
                background: option.swatch,
                boxShadow: `0 0 8px ${option.swatch}`,
              }}
            />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
