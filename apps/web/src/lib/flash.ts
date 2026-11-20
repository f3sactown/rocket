"use client";

/**
 * A one-time note for the next screen (e.g. Home after Done offline: "Added to your drafts"),
 * kept for this visit only.
 */
const KEY = "rocket-flash";

export function setFlash(text: string) {
  try {
    sessionStorage.setItem(KEY, text);
  } catch {
    // Not shown.
  }
}

/** The note left for this screen, once (it's gone after). */
export function takeFlash(): string | null {
  try {
    const text = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return text;
  } catch {
    return null;
  }
}
