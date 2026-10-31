import { describe, expect, it } from "vitest";
import {
  attendeeLabel,
  formatDate,
  formatBackblast,
  paxCount,
  type Backblast,
} from "./backblast";

const base: Backblast = {
  title: "Hills for days",
  date: "2026-10-30",
  ao: "The Grove",
  q: "Sparky",
  attendees: [
    { name: "Tinman", kind: "pax" },
    { name: "Huggies", kind: "visitor", region: "South Fork" },
    { name: "Rookie", kind: "fng", invitedBy: "Tinman" },
    { name: "Little Sparky", kind: "2.0" },
  ],
};

describe("attendeeLabel", () => {
  it("shows a visitor's home region", () => {
    expect(
      attendeeLabel({ name: "Huggies", kind: "visitor", region: "South Fork" }),
    ).toBe("Huggies (South Fork)");
  });

  it("marks FNGs with who invited them", () => {
    expect(
      attendeeLabel({ name: "Rookie", kind: "fng", invitedBy: "Tinman" }),
    ).toBe("Rookie (FNG, invited by Tinman)");
    expect(attendeeLabel({ name: "Rookie", kind: "fng" })).toBe("Rookie (FNG)");
  });

  it("marks 2.0s", () => {
    expect(attendeeLabel({ name: "Little Sparky", kind: "2.0" })).toBe(
      "Little Sparky (2.0)",
    );
  });
});

describe("paxCount", () => {
  it("counts the Q and every attendee", () => {
    expect(paxCount(base)).toBe(5);
  });

  it("ignores duplicates, blank names and the Q listed twice", () => {
    expect(
      paxCount({
        ...base,
        attendees: [
          { name: "Tinman", kind: "pax" },
          { name: "tinman ", kind: "pax" },
          { name: "Sparky", kind: "pax" },
          { name: "", kind: "pax" },
        ],
      }),
    ).toBe(2);
  });
});

describe("formatDate", () => {
  it("writes the date out with an ordinal day", () => {
    expect(formatDate("2026-10-31")).toBe("October 31st, 2026");
    expect(formatDate("2026-01-02")).toBe("January 2nd, 2026");
    expect(formatDate("2026-03-03")).toBe("March 3rd, 2026");
    expect(formatDate("2026-11-11")).toBe("November 11th, 2026");
    expect(formatDate("2026-12-12")).toBe("December 12th, 2026");
    expect(formatDate("2026-05-22")).toBe("May 22nd, 2026");
    expect(formatDate("2026-07-23")).toBe("July 23rd, 2026");
  });

  it("leaves anything else alone", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("tomorrow")).toBe("tomorrow");
  });
});

describe("formatBackblast", () => {
  const text = formatBackblast({
    ...base,
    thang: "  11s on the hill  ",
    secondF: "Coffee",
  });

  it("lists only the sections that have content, in order, without asterisks", () => {
    const headings = [...text.matchAll(/^([^:\n]+):$/gm)].map(
      (match) => match[1],
    );
    expect(headings).toEqual([
      "The Thang",
      "Count-o-rama",
      "Name-o-rama",
      "Second F",
    ]);
    expect(text).not.toContain("*");
    expect(text).not.toContain("None");
  });

  it("writes the header with a written-out date and no Q line", () => {
    expect(text.split("\n\n")[0]).toBe(
      "Backblast: Hills for days\nDate: October 30th, 2026\nAO: The Grove",
    );
  });

  it("puts the Q in the Name-o-rama", () => {
    expect(text).toContain("Count-o-rama:\n5");
    expect(text).toContain(
      "Name-o-rama:\nSparky (Q), Tinman, Huggies (South Fork), Rookie (FNG, invited by Tinman), Little Sparky (2.0)",
    );
    expect(text).toContain("The Thang:\n11s on the hill");
  });
});
