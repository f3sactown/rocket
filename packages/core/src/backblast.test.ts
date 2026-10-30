import { describe, expect, it } from "vitest";
import {
  attendeeLabel,
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

describe("formatBackblast", () => {
  const text = formatBackblast({
    ...base,
    thang: "  11s on the hill  ",
    secondF: "Coffee",
  });

  it("lists every section in order", () => {
    const headings = [...text.matchAll(/^\*([^*]+):\*$/gm)].map(
      (match) => match[1],
    );
    expect(headings).toEqual([
      "Introduction",
      "Warm-o-rama",
      "The Thang",
      "Count-o-rama",
      "Name-o-rama",
      "Announcements",
      "Words of Wisdom",
      "Third F",
      "Second F",
    ]);
  });

  it("fills in attendance and section bodies", () => {
    expect(text).toContain("*Count-o-rama:*\n5");
    expect(text).toContain(
      "*Name-o-rama:*\nSparky, Tinman, Huggies (South Fork), Rookie (FNG, invited by Tinman), Little Sparky (2.0)",
    );
    expect(text).toContain("*The Thang:*\n11s on the hill");
    expect(text).toContain("*Announcements:*\nNone");
  });
});
