import { describe, expect, it } from "vitest";
import { paxBaseName } from "./pax-names";

const F3 = ["F3 SacTown", "F3 DryCreek"];

describe("paxBaseName", () => {
  it("drops a region named in parentheses", () => {
    expect(paxBaseName("Baby Shark (Dry Creek)", F3)).toBe("Baby Shark");
    expect(paxBaseName("Baby Shark (DryCreek)", F3)).toBe("Baby Shark");
    expect(paxBaseName("Baby Shark (F3 Dry Creek)", F3)).toBe("Baby Shark");
    expect(paxBaseName(" Tinman  (sactown) ", F3)).toBe("Tinman");
  });

  it("keeps parentheses that aren't one of the regions", () => {
    expect(paxBaseName("Cubby (2.0)", F3)).toBe("Cubby (2.0)");
    expect(paxBaseName("McLovin (Seattle)", F3)).toBe("McLovin (Seattle)");
    expect(paxBaseName("Plain", F3)).toBe("Plain");
  });

  it("only matches the regions it's given", () => {
    expect(paxBaseName("Bolt (Dry Creek)", ["FiA SacTown"])).toBe(
      "Bolt (Dry Creek)",
    );
  });
});
