import { describe, expect, it } from "vitest";
import { parseChangelog } from "./changelog";

const CHANGELOG = `# Changelog

Intro text with a [link](https://example.com).

## [0.1.0-alpha.2](https://github.com/x/y/compare/v0.1.0-alpha.1...v0.1.0-alpha.2) (2026-11-08)


### Features

* nightly backups ([b5ce9b0](https://github.com/x/y/commit/b5ce9b0))
* nightly backups ([c1049bf](https://github.com/x/y/commit/c1049bf))
* **Home:** Today's workouts, and
  Trending as a sideways row.

### Bug Fixes

* count FNGs in [the totals](https://example.com) (#12)

## [0.1.0-alpha.1](https://github.com/x/y/compare/v0.1.0-alpha.0...v0.1.0-alpha.1) (2026-11-03)

### Features

* first release
`;

describe("parseChangelog", () => {
  it("reads every release, newest first, cleaned and without repeats", () => {
    expect(parseChangelog(CHANGELOG)).toEqual([
      {
        version: "0.1.0-alpha.2",
        date: "2026-11-08",
        sections: [
          {
            title: "Features",
            items: [
              "nightly backups",
              "**Home:** Today's workouts, and Trending as a sideways row.",
            ],
          },
          { title: "Bug Fixes", items: ["count FNGs in the totals"] },
        ],
      },
      {
        version: "0.1.0-alpha.1",
        date: "2026-11-03",
        sections: [{ title: "Features", items: ["first release"] }],
      },
    ]);
  });

  it("is empty without releases", () => {
    expect(parseChangelog("# Changelog\n\nNothing yet.")).toEqual([]);
  });
});
