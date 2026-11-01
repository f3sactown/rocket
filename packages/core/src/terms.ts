/** Which organization's vocabulary the app uses. */
export type Language = "f3" | "fia";

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "f3", label: "F3" },
  { value: "fia", label: "FiA" },
];

export interface Terms {
  /** The organization's name, e.g. in "F3 name". */
  org: string;
  warmup: string;
  thang: string;
  thirdF: string;
  secondF: string;
}

const TERMS: Record<Language, Terms> = {
  f3: {
    org: "F3",
    warmup: "Warm-o-rama",
    thang: "The Thang",
    thirdF: "Third F",
    secondF: "Second F",
  },
  fia: {
    org: "FiA",
    warmup: "Warm-up",
    thang: "The Workout",
    thirdF: "Community",
    secondF: "Fellowship",
  },
};

/** The words to use for a language; anything unrecognized falls back to F3. */
export function termsFor(language: string | undefined): Terms {
  return TERMS[language === "fia" ? "fia" : "f3"];
}
