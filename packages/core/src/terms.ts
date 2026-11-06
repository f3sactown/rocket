/** Which organization's vocabulary the app uses. */
export type Language = "f3" | "fia";

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "f3", label: "F3" },
  { value: "fia", label: "FiA" },
];

export interface Terms {
  /** The organization's name, e.g. in "F3 name". */
  org: string;
  /** One gathering to work out: an F3 "beatdown", a FiA "workout". */
  beatdown: string;
  warmup: string;
  thang: string;
  /** The backblast's coffee section: F3's Coffeeteria, FiA's CoFiA. */
  secondF: string;
}

const TERMS: Record<Language, Terms> = {
  f3: {
    org: "F3",
    beatdown: "beatdown",
    warmup: "Warm-o-rama",
    thang: "The Thang",
    secondF: "Coffeeteria",
  },
  fia: {
    org: "FiA",
    beatdown: "workout",
    warmup: "Warm-up",
    thang: "The Workout",
    secondF: "CoFiA",
  },
};

/** The words to use for a language; anything unrecognized falls back to F3. */
export function termsFor(language: string | undefined): Terms {
  return TERMS[language === "fia" ? "fia" : "f3"];
}
