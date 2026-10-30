import { describe, expect, it } from "vitest";
import { estimateRainwater } from "./rainwater";

describe("estimateRainwater", () => {
  it("collects area × rainfall × runoff coefficient litres", () => {
    // 100 m² × 700 mm × 0.8
    const estimate = estimateRainwater({ roofAreaM2: 100, annualRainfallMm: 700 });
    expect(estimate.annualLitres).toBeCloseTo(56_000);
    // A household of 4 at 135 litres per person per day uses 540 litres a day.
    expect(estimate.householdDays).toBeCloseTo(56_000 / 540);
  });

  it("scales with household size", () => {
    const estimate = estimateRainwater({ roofAreaM2: 100, annualRainfallMm: 700, householdSize: 2 });
    expect(estimate.householdDays).toBeCloseTo(56_000 / 270);
  });

  it("rejects invalid inputs", () => {
    expect(() => estimateRainwater({ roofAreaM2: -1, annualRainfallMm: 700 })).toThrow(RangeError);
    expect(() => estimateRainwater({ roofAreaM2: 100, annualRainfallMm: Number.NaN })).toThrow(RangeError);
    expect(() => estimateRainwater({ roofAreaM2: 100, annualRainfallMm: 700, householdSize: 0 })).toThrow(RangeError);
  });
});
