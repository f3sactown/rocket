"use client";

/**
 * Installing Rocket as an app on this device: whether it's already running as one, which kind of
 * device it is (for the right instructions), and the browser's own install prompt where it offers
 * one (Chrome and Edge on Android and computers).
 */

/** The browser's install prompt, kept for an Install button (not in every browser's types). */
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let prompt: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Hold it for Rocket's own Install button instead of the browser's banner.
    event.preventDefault();
    prompt = event as InstallPrompt;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    prompt = null;
    notify();
  });
}

export function subscribeInstall(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether the browser has offered to install Rocket (so an Install button can show its prompt). */
export const canPromptInstall = () => prompt !== null;

/** Shows the browser's install prompt; true if the person installed it. */
export async function promptInstall(): Promise<boolean> {
  if (!prompt) return false;
  const shown = prompt;
  prompt = null;
  notify();
  await shown.prompt();
  return (await shown.userChoice).outcome === "accepted";
}

/** Whether Rocket is running as an installed app (from the Home Screen or an app window). */
export function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export type Device = "ios" | "android" | "computer";

/** Which instructions fit this device. */
export function deviceKind(): Device {
  if (typeof navigator === "undefined") return "computer";
  const ua = navigator.userAgent;
  if (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
    return "ios";
  if (/Android/i.test(ua)) return "android";
  return "computer";
}
