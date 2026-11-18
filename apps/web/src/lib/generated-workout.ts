import { thangText, type Thang, type Workout } from "@rocket/core";

/** Where a generated workout waits for the new workout form, which takes it once. */
const KEY = "rocket-generated-workout";

/** A generated workout as it goes into the form: its Warm-o-rama text and its thangs. */
export interface GeneratedForForm {
  warmup: string;
  thangs: Thang[];
}

/** Hands a generated workout to the new workout form. */
export function keepGenerated(workout: GeneratedForForm) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(workout));
  } catch {
    // Without storage the form opens blank.
  }
}

/** The generated workout waiting for the form, as its start (taken once), or null. */
export function takeGenerated(blank: Workout): Workout | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const generated = JSON.parse(raw) as GeneratedForForm;
    return {
      ...blank,
      warmup: generated.warmup,
      thangs: generated.thangs,
      thang: thangText(generated.thangs),
    };
  } catch {
    return null;
  }
}
