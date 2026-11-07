import { describe, expect, it } from "vitest";
import { buildChanges } from "./build-changes";

describe("buildChanges", () => {
  it("keeps features, fixes and performance work, cleaned up", () => {
    expect(
      buildChanges(
        [
          "feat: region colors start with blue, then pink",
          "fix(pax)!: count FNGs in the totals",
          "perf: paginate backblast list",
          "chore: bump deps",
          "docs: update README",
          "chore(main): release 0.1.0-alpha.5",
          "Merge pull request #1 from x/y",
          "feat: region colors start with blue, then pink",
          "",
        ].join("\n"),
      ),
    ).toEqual([
      "Region colors start with blue, then pink",
      "Count FNGs in the totals",
      "Paginate backblast list",
    ]);
  });

  it("is empty when nothing user-facing changed", () => {
    expect(buildChanges("chore: tidy\nci: cache pnpm")).toEqual([]);
    expect(buildChanges("")).toEqual([]);
  });
});
