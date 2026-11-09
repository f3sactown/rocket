import { describe, expect, it } from "vitest";
import { isPlaceholderPax } from "./placeholder-pax";

describe("isPlaceholderPax", () => {
  it("spots a closed-site marker", () => {
    expect(isPlaceholderPax("Site Closed (Archived)")).toBe(true);
    expect(isPlaceholderPax("site closed")).toBe(true);
    expect(isPlaceholderPax("SiteClosed")).toBe(true);
  });

  it("leaves real PAX alone", () => {
    expect(isPlaceholderPax("Carter")).toBe(false);
    expect(isPlaceholderPax("Closer")).toBe(false);
    expect(isPlaceholderPax("Baby Shark (Dry Creek)")).toBe(false);
  });
});
