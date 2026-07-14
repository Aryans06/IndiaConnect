import { describe, it, expect } from "vitest";
import { toTsQuery } from "./search";

describe("toTsQuery", () => {
  it("requires ALL terms by default, for precision", () => {
    // "farmer loan" must mean farming AND lending — not any scheme that merely
    // mentions a loan.
    expect(toTsQuery("old age pension")).toBe("old:* & age:* & pension:*");
  });

  it("can loosen to ANY term as a fallback", () => {
    expect(toTsQuery("old age pension", "any")).toBe(
      "old:* | age:* | pension:*",
    );
  });

  it("prefix-matches so partial words hit", () => {
    expect(toTsQuery("pens")).toBe("pens:*");
  });

  it("strips punctuation that would break tsquery syntax", () => {
    // The stray "s" from "farmer's" is dropped as a single character.
    expect(toTsQuery("farmer's loan! (subsidy)")).toBe(
      "farmer:* & loan:* & subsidy:*",
    );
  });

  it("drops single characters and noise", () => {
    expect(toTsQuery("a pension")).toBe("pension:*");
  });

  it("returns null for an empty or meaningless query", () => {
    expect(toTsQuery("")).toBeNull();
    expect(toTsQuery("   ")).toBeNull();
    expect(toTsQuery("!!! ?")).toBeNull();
  });

  it("handles non-Latin scripts (Hindi query)", () => {
    expect(toTsQuery("पेंशन")).toBe("पेंशन:*");
  });
});
