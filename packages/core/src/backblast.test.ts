import { describe, expect, it } from "vitest";
import { formatBackblast, paxCount, type Backblast } from "./backblast";

const base: Backblast = {
  title: "Hills for days",
  date: "2026-10-30",
  ao: "The Grove",
  q: "Sparky",
  pax: ["Tinman", "Gator"],
  fngs: [],
};

describe("paxCount", () => {
  it("counts the Q, PAX and FNGs", () => {
    expect(paxCount({ ...base, fngs: ["Rookie"] })).toBe(4);
  });

  it("ignores duplicates and blank names", () => {
    expect(
      paxCount({ ...base, pax: ["Tinman", "tinman ", "Sparky", ""] }),
    ).toBe(2);
  });
});

describe("formatBackblast", () => {
  it("renders the header fields", () => {
    const text = formatBackblast(base);
    expect(text).toContain("*Backblast: Hills for days*");
    expect(text).toContain("PAX: Tinman, Gator");
    expect(text).toContain("FNGs: None");
    expect(text).toContain("COUNT: 3");
  });

  it("only includes sections that have content", () => {
    const text = formatBackblast({
      ...base,
      thang: "  11s on the hill  ",
      moleskin: " ",
    });
    expect(text).toContain("*THE THANG:*\n11s on the hill");
    expect(text).not.toContain("WARMUP");
    expect(text).not.toContain("MOLESKIN");
  });
});
