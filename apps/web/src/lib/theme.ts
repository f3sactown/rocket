export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "rocket-theme";

/**
 * Runs before first paint (inlined in the page head) so the page never flashes the wrong theme.
 * Sets <html data-theme> to the saved choice, or to the OS theme when there's none.
 */
export const themeScript = `(() => {
  try {
    var p = localStorage.getItem("${THEME_STORAGE_KEY}");
    var light = p === "light" || (p !== "dark" && matchMedia("(prefers-color-scheme: light)").matches);
    document.documentElement.dataset.theme = light ? "light" : "dark";
  } catch (e) {}
})();`;
