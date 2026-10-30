import { describe, expect, it } from "vitest";
import { isInIndiaBounds } from "./india";

describe("isInIndiaBounds", () => {
  it("accepts mainland and island locations", () => {
    expect(isInIndiaBounds(18.5204, 73.8567)).toBe(true); // Pune
    expect(isInIndiaBounds(11.6234, 92.7265)).toBe(true); // Port Blair
    expect(isInIndiaBounds(10.5667, 72.6417)).toBe(true); // Kavaratti
  });

  it("rejects locations outside India and invalid numbers", () => {
    expect(isInIndiaBounds(51.5072, -0.1276)).toBe(false); // London
    expect(isInIndiaBounds(Number.NaN, 73)).toBe(false);
  });
});
