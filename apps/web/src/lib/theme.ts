export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "rocket-theme";

export type Accent = "f3" | "fia" | "blue" | "green" | "orange" | "violet";

export const ACCENT_STORAGE_KEY = "rocket-accent";

/** Set to "off" on a device to skip the launch animation. */
export const SPLASH_STORAGE_KEY = "rocket-splash";

/** The rocket's trim in an accent: nose and fin edges, fins and porthole ring, stripe. */
export interface RocketColors {
  light: string;
  mid: string;
  dark: string;
}

/**
 * Accent colors, in the order they're offered. Swatches are the dark-theme shades; `rocket` is
 * the matching trim for the rocket artwork (mirrored as --rocket-* in globals.css).
 */
export const ACCENTS: {
  value: Accent;
  label: string;
  swatch: string;
  rocket: RocketColors;
}[] = [
  {
    // F3's red: the default, and what choosing an F3 region switches to.
    value: "f3",
    label: "Red",
    swatch: "#e0544a",
    rocket: { light: "#ec8a81", mid: "#9e3a33", dark: "#6b2621" },
  },
  {
    // FiA's teal: what choosing a FiA region switches to.
    value: "fia",
    label: "Teal",
    swatch: "#2dd4bf",
    rocket: { light: "#7ee8da", mid: "#1f8a7e", dark: "#155e57" },
  },
  {
    value: "blue",
    label: "Blue",
    swatch: "#60a5fa",
    rocket: { light: "#8cc8f0", mid: "#3d6a85", dark: "#2d4a5e" },
  },
  {
    value: "green",
    label: "Green",
    swatch: "#4ade80",
    rocket: { light: "#8fe8ac", mid: "#2f8a4f", dark: "#1f5e36" },
  },
  {
    value: "orange",
    label: "Orange",
    swatch: "#fb923c",
    rocket: { light: "#fcc08a", mid: "#b4642a", dark: "#7a421b" },
  },
  {
    value: "violet",
    label: "Violet",
    swatch: "#a78bfa",
    rocket: { light: "#c4b5fd", mid: "#6d4bb8", dark: "#4a3380" },
  },
];

/**
 * Runs before first paint (inlined in the page head) so the page never flashes the wrong look.
 * Sets <html data-theme> to the saved choice, or to the OS theme when there's none, and
 * <html data-accent> to the saved accent color, and <html data-splash="off"> when the launch
 * animation is turned off.
 */
export const themeScript = `(() => {
  try {
    var root = document.documentElement;
    var p = localStorage.getItem("${THEME_STORAGE_KEY}");
    var light = p === "light" || (p !== "dark" && matchMedia("(prefers-color-scheme: light)").matches);
    root.dataset.theme = light ? "light" : "dark";
    var a = localStorage.getItem("${ACCENT_STORAGE_KEY}");
    if (${JSON.stringify(["fia", "blue", "green", "orange", "violet"])}.indexOf(a) >= 0) root.dataset.accent = a;
    if (localStorage.getItem("${SPLASH_STORAGE_KEY}") === "off") root.dataset.splash = "off";
  } catch (e) {}
})();`;
