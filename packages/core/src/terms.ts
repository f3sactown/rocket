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
  /** The closing thoughts section: F3's Words of Wisdom, FiA's CoT. */
  wordsOfWisdom: string;
  /**
   * Running someone else's workout as your own: F3's Reuse, FiA's R&R. Its forms: the button
   * ("Reuse"), one in a sentence ("reuse"), more than one ("reuses", or as a heading "Reuses"), and
   * done ("reused").
   */
  reuse: {
    title: string;
    one: string;
    many: string;
    manyTitle: string;
    done: string;
  };
}

const TERMS: Record<Language, Terms> = {
  f3: {
    org: "F3",
    beatdown: "beatdown",
    warmup: "Warm-o-rama",
    thang: "The Thang",
    secondF: "Coffeeteria",
    wordsOfWisdom: "Words of Wisdom",
    reuse: {
      title: "Reuse",
      one: "reuse",
      many: "reuses",
      manyTitle: "Reuses",
      done: "reused",
    },
  },
  fia: {
    org: "FiA",
    beatdown: "workout",
    warmup: "Warm-up",
    thang: "The Workout",
    secondF: "CoFiA",
    wordsOfWisdom: "CoT",
    reuse: {
      title: "R&R",
      one: "R&R",
      many: "R&Rs",
      manyTitle: "R&Rs",
      done: "R&R'd",
    },
  },
};

/** The words to use for a language; anything unrecognized falls back to F3. */
export function termsFor(language: string | undefined): Terms {
  return TERMS[language === "fia" ? "fia" : "f3"];
}

/**
 * Fixed text (written with F3's words) in the user's words: for FiA, "reuse" becomes "R&R"
 * ("reuses" "R&Rs", "reused" "R&R'd", "reusing" "R&R'ing").
 */
export function inTermsOf(text: string, language: string | undefined): string {
  if (language !== "fia") return text;
  return text.replace(/\breus(e|es|ed|ing)\b/gi, (_, end: string) => {
    const tail = { e: "", es: "s", ed: "'d", ing: "'ing" }[
      end.toLowerCase() as "e" | "es" | "ed" | "ing"
    ];
    return `R&R${tail}`;
  });
}
