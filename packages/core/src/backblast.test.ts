import { describe, expect, it } from "vitest";
import {
  attendeeLabel,
  backblastParts,
  formatDate,
  formatBackblast,
  formatShortDate,
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
  it("shows a downrange PAX's home region", () => {
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

describe("formatShortDate", () => {
  it("writes the weekday, month and day", () => {
    expect(formatShortDate("2026-10-14")).toBe("Wed, Oct 14, 2026");
    expect(formatShortDate("2026-10-31")).toBe("Sat, Oct 31, 2026");
  });

  it("leaves anything else alone", () => {
    expect(formatShortDate("")).toBe("");
    expect(formatShortDate("2026-02-30")).toBe("2026-02-30");
  });
});

describe("formatBackblast", () => {
  const talko: Backblast = {
    title: "Hills for days",
    date: "2026-10-14",
    ao: "Talko Tuesday",
    address: "Oki Park - 2715 Wissemann Dr, Sacramento, CA 95826",
    q: "Casper",
    attendees: [
      ...["Samantha", "Trench", "Tupperware", "Scooper", "Righty"].map(
        (name) => ({
          name,
          kind: "pax" as const,
        }),
      ),
      { name: "Dingo", kind: "visitor" },
      { name: "Ellie", kind: "fng" },
    ],
    thang: "  11s on the hill  ",
    secondF: "Coffee",
  };
  const text = formatBackblast(talko);
  const parts = backblastParts(talko).map((part) => part.text);

  it("splits into Event Data, Workout Details and COT / Closing for the review screen", () => {
    expect(backblastParts(talko).map((part) => part.title)).toEqual([
      "Event Data",
      "Workout Details",
      "COT / Closing",
    ]);
  });

  it("copies the parts as plain text with no headings or markup", () => {
    expect(text).toBe(parts.join("\n\n"));
    expect(text).not.toMatch(/Event Data|Workout Details|COT \/ Closing|[*•━]/);
  });

  it("writes Event Data in the region's format", () => {
    expect(parts[0].trim()).toBe(
      [
        "Talko Tuesday - Wed, Oct 14, 2026",
        "Oki Park - 2715 Wissemann Dr, Sacramento, CA 95826",
        "",
        "Total Attendees: 8",
        "",
        "Q: @Casper",
        "",
        "PAX (5):",
        "@Samantha",
        "@Trench",
        "@Tupperware",
        "@Scooper",
        "@Righty",
        "",
        "Downrange PAX (1):",
        "@Dingo",
        "",
        "FNGs (1):",
        "@Ellie",
      ].join("\n"),
    );
  });

  it("adds home regions, who invited FNGs, and 2.0s when given", () => {
    const detailed = formatBackblast({
      ...talko,
      attendees: [
        { name: "Dingo", kind: "visitor", region: "South Fork" },
        { name: "Ellie", kind: "fng", invitedBy: "Casper" },
        { name: "Little Casper", kind: "2.0" },
      ],
    });
    expect(detailed).toContain("Downrange PAX (1):\n@Dingo (South Fork)");
    expect(detailed).toContain("FNGs (1):\n@Ellie (invited by @Casper)");
    expect(detailed).toContain("2.0s (1):\n@Little Casper (2.0)");
    expect(detailed).not.toContain("PAX (0)");
  });

  it("puts the title and workout in Workout Details and leaves out blank sections", () => {
    expect(parts[1].trim()).toBe(
      "Title: Hills for days\n\nThe Thang:\n11s on the hill",
    );
    expect(parts[2].trim()).toBe("Second F:\nCoffee");
  });

  it("leaves out a part with nothing in it", () => {
    const titles = backblastParts({ ...talko, secondF: undefined }).map(
      (part) => part.title,
    );
    expect(titles).toEqual(["Event Data", "Workout Details"]);
  });
});
