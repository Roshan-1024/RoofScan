import { describe, expect, it } from "vitest";
import { negotiateLocale } from "./negotiate";

describe("negotiateLocale", () => {
  it("falls back to English without a header", () => {
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("")).toBe("en");
  });

  it("matches a regional tag to its base language", () => {
    expect(negotiateLocale("hi-IN,hi;q=0.9,en;q=0.8")).toBe("hi");
  });

  it("ranks by q-value, not by position", () => {
    expect(negotiateLocale("en;q=0.4,hi;q=0.9")).toBe("hi");
  });

  it("keeps header order for equal q-values", () => {
    expect(negotiateLocale("en-GB,hi")).toBe("en");
  });

  it("skips unsupported languages", () => {
    expect(negotiateLocale("ta-IN,mr;q=0.9,hi;q=0.5")).toBe("hi");
    expect(negotiateLocale("fr,de")).toBe("en");
  });

  it("ignores q=0 and malformed q-values", () => {
    expect(negotiateLocale("hi;q=0,en;q=0.5")).toBe("en");
    expect(negotiateLocale("hi;q=abc")).toBe("en");
  });
});
