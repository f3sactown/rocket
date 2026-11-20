import { describe, expect, it } from "vitest";
import { inTermsOf, termsFor } from "./terms";

describe("reuse in FiA's words", () => {
  it("is R&R for FiA and Reuse for F3", () => {
    expect(termsFor("fia").reuse).toMatchObject({ title: "R&R", many: "R&Rs" });
    expect(termsFor("f3").reuse.title).toBe("Reuse");
  });

  it("puts fixed text in FiA's words", () => {
    expect(
      inTermsOf(
        "Like it or reuse it. Most reused, likes and reuses, reusing lately. Reuse it.",
        "fia",
      ),
    ).toBe(
      "Like it or R&R it. Most R&R'd, likes and R&Rs, R&R'ing lately. R&R it.",
    );
    expect(inTermsOf("Reuse it", "f3")).toBe("Reuse it");
  });
});
