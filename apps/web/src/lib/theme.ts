export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "rocket-theme";

export type Accent = "f3" | "fia" | "blue" | "green" | "orange";

export const ACCENT_STORAGE_KEY = "rocket-accent";

/** Accent colors, in the order they're offered. Swatches are the dark-theme shades. */
export const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: "f3", label: "F3", swatch: "#ef6b62" },
  { value: "fia", label: "FiA", swatch: "#2dd4bf" },
  { value: "blue", label: "Blue", swatch: "#60a5fa" },
  { value: "green", label: "Green", swatch: "#4ade80" },
  { value: "orange", label: "Orange", swatch: "#fb923c" },
];

/**
 * Runs before first paint (inlined in the page head) so the page never flashes the wrong look.
 * Sets <html data-theme> to the saved choice, or to the OS theme when there's none, and
 * <html data-accent> to the saved accent color.
 */
export const themeScript = `(() => {
  try {
    var root = document.documentElement;
    var p = localStorage.getItem("${THEME_STORAGE_KEY}");
    var light = p === "light" || (p !== "dark" && matchMedia("(prefers-color-scheme: light)").matches);
    root.dataset.theme = light ? "light" : "dark";
    var a = localStorage.getItem("${ACCENT_STORAGE_KEY}");
    if (${JSON.stringify(["fia", "blue", "green", "orange"])}.indexOf(a) >= 0) root.dataset.accent = a;
  } catch (e) {}
})();`;
