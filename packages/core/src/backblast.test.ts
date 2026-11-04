import { describe, expect, it } from "vitest";
import {
  attendeeFromName,
  copyText,
  copyWorkout,
  thangText,
  paxList,
  qNames,
  titleCase,
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
    time: "5:15am-6:00am",
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
        "Talko Tuesday - Wed, Oct 14, 2026 - 5:15am-6:00am",
        "Oki Park",
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
      "Title: Hills for Days\n\nThe Thang:\n11s on the hill",
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

describe("FiA vocabulary", () => {
  it("uses Warm-up, The Workout, Community and Fellowship", () => {
    const fia = formatBackblast(
      {
        ...base,
        warmup: "SSH x20",
        thang: "11s on the hill",
        thirdF: "Praises",
        secondF: "Coffee",
      },
      "fia",
    );
    expect(fia).toContain("Warm-up:\nSSH x20");
    expect(fia).toContain("The Workout:\n11s on the hill");
    expect(fia).toContain("Community:\nPraises");
    expect(fia).toContain("Fellowship:\nCoffee");
    expect(fia).not.toMatch(/Warm-o-rama|Thang|Third F|Second F/);
  });

  it("keeps F3 words by default", () => {
    const f3 = formatBackblast({ ...base, warmup: "SSH x20", thang: "11s" });
    expect(f3).toContain("Warm-o-rama:\nSSH x20");
    expect(f3).toContain("The Thang:\n11s");
  });
});

describe("attendeeFromName", () => {
  it("reads a home region or 2.0 note after the name", () => {
    expect(attendeeFromName("McLovin (Seattle)")).toEqual({
      name: "McLovin",
      kind: "visitor",
      region: "Seattle",
    });
    expect(attendeeFromName("Cubby (2.0)")).toEqual({
      name: "Cubby",
      kind: "2.0",
    });
    expect(attendeeFromName("Sparky")).toEqual({ name: "Sparky", kind: "pax" });
  });
});

describe("several Qs", () => {
  const coQ: Backblast = {
    title: "Co-Q",
    date: "2026-10-14",
    ao: "Talko Tuesday",
    q: "Casper, Sparky , casper",
    attendees: [
      { name: "Sparky", kind: "pax" },
      { name: "Trench", kind: "pax" },
    ],
  };

  it("reads the Q field as a list", () => {
    expect(qNames(coQ)).toEqual(["Casper", "Sparky"]);
  });

  it("counts each Q once and lists them together", () => {
    expect(paxCount(coQ)).toBe(3);
    const eventData = backblastParts(coQ)[0]!.text;
    expect(eventData).toContain("Qs: @Casper, @Sparky");
    expect(eventData).toContain("PAX (1):\n@Trench");
  });
});

describe("titleCase", () => {
  it("capitalizes words but not short ones in the middle", () => {
    expect(titleCase("hills for days and the merkins of doom")).toBe(
      "Hills for Days and the Merkins of Doom",
    );
    expect(titleCase("the coupon is what it is in")).toBe(
      "The Coupon Is What It Is In",
    );
  });

  it("keeps capitals already there and handles colons and hyphens", () => {
    expect(titleCase("WOD at McKinley: a full-body burner")).toBe(
      "WOD at McKinley: A Full-Body Burner",
    );
  });
});

describe("paxList", () => {
  const backblast: Backblast = {
    title: "Hills",
    date: "2026-10-14",
    ao: "Talko Tuesday",
    q: "Casper, Sparky",
    attendees: [
      { name: "Huggies", kind: "visitor", region: "South Fork" },
      { name: "Rookie", kind: "fng", invitedBy: "Sparky" },
      { name: "Cubby", kind: "2.0" },
      { name: "Trench", kind: "pax" },
    ],
  };

  it("lists everyone without @, keeping downrange regions and 2.0s but not FNG notes", () => {
    expect(paxList(backblast)).toBe(
      "Casper, Sparky, Huggies (South Fork), Rookie, Cubby (2.0), Trench",
    );
  });

  it("ends the copied text, after three blank lines", () => {
    expect(
      copyText(backblast).endsWith(
        "Hills\n\n\n\nCasper, Sparky, Huggies (South Fork), Rookie, Cubby (2.0), Trench",
      ),
    ).toBe(true);
  });
});

describe("notes", () => {
  it("come after The Thang in Workout Details", () => {
    const parts = backblastParts({
      title: "Hills",
      date: "2026-10-14",
      ao: "Talko Tuesday",
      q: "Casper",
      attendees: [],
      thang: "11s",
      notes: "Bring a headlamp",
    });
    expect(parts[1]!.text).toBe(
      "Title: Hills\n\nThe Thang:\n11s\n\nNotes:\nBring a headlamp",
    );
  });
});

describe("copyWorkout", () => {
  it("copies every workout section but the notes", () => {
    const workout = {
      title: "Hills",
      date: "2026-10-14",
      ao: "Talko Tuesday",
      address: "Oki Park",
      time: "5:15am-6:00am",
      q: "",
      attendees: [],
      introduction: "Intro",
      warmup: "SSH",
      thang: "11s",
      notes: "Workout note",
      announcements: "Convergence",
      wordsOfWisdom: "Keep going",
    };
    const backblast = copyWorkout(
      {
        title: "",
        date: "",
        ao: "",
        q: "Casper",
        attendees: [],
        notes: "Mine",
      },
      workout,
    );
    expect(backblast).toMatchObject({
      title: "Hills",
      ao: "Talko Tuesday",
      thang: "11s",
      wordsOfWisdom: "Keep going",
      notes: "Mine",
      q: "Casper",
    });
  });
});

describe("thangs", () => {
  it("adds each thang's music title and link", () => {
    expect(
      thangText([
        {
          text: "Burpees",
          music: {
            url: "https://open.spotify.com/track/abc",
            title: "Eye of the Tiger",
          },
        },
        { text: "Run", music: { url: "https://youtu.be/xyz" } },
      ]),
    ).toBe(
      "Burpees\n🎵 Eye of the Tiger 🎵 https://open.spotify.com/track/abc\n\nRun\n🎵 https://youtu.be/xyz",
    );
    expect(thangText([{ text: "Solo", music: { url: "not a link" } }])).toBe(
      "Solo",
    );
  });

  it("writes thangs separated by blank lines", () => {
    expect(thangText([{ text: "11s" }])).toBe("11s");
    expect(
      thangText([
        { text: "11s", timer: { type: "countdown", seconds: 600 } },
        { text: " " },
        { text: "Dora 1-2-3", timer: { type: "stopwatch" } },
      ]),
    ).toBe("11s\n\nDora 1-2-3");
  });
});
