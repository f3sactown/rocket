import { describe, expect, it } from "vitest";
import { releaseNotes } from "./release-notes";

const CHANGELOG = `# Changelog

Intro text.

## [0.1.0-alpha.4](https://github.com/x/y/compare/v0.1.0-alpha.3...v0.1.0-alpha.4) (2026-11-06)

### Features

* **Home:** Today's workouts (tap to run), Future workouts, and
  Trending as a sideways row.
* **PAX:** a new page ([abc1234](https://github.com/x/y/commit/abc1234))

### Bug Fixes

* count FNGs in [the totals](https://example.com) (#12)

## [0.1.0-alpha.3](https://github.com/x/y/compare/v0.1.0-alpha.2...v0.1.0-alpha.3) (2026-11-05)

### Features

* older
`;

describe("releaseNotes", () => {
  it("reads one version's sections, joining wrapped lines and cleaning links", () => {
    expect(releaseNotes(CHANGELOG, "0.1.0-alpha.4")).toEqual({
      version: "0.1.0-alpha.4",
      date: "2026-11-06",
      sections: [
        {
          title: "Features",
          items: [
            "**Home:** Today's workouts (tap to run), Future workouts, and Trending as a sideways row.",
            "**PAX:** a new page",
          ],
        },
        { title: "Bug Fixes", items: ["count FNGs in the totals"] },
      ],
    });
  });

  it("stops at the next release", () => {
    expect(releaseNotes(CHANGELOG, "0.1.0-alpha.3")?.sections).toEqual([
      { title: "Features", items: ["older"] },
    ]);
  });

  it("doesn't confuse a version with a longer one", () => {
    expect(releaseNotes(CHANGELOG, "0.1.0-alpha")).toBeNull();
    expect(releaseNotes(CHANGELOG, "0.1.0-alpha.9")).toBeNull();
  });
});
