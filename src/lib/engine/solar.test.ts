import { describe, expect, it } from "vitest";
import pune from "@/lib/data/__fixtures__/nasa-power-pune.json";
import { parseSolarResource } from "@/lib/data/nasa-power";
import { ANNUAL_DEGRADATION, LIFETIME_YEARS, MODULE_KW } from "./assumptions";
import { monthlyYieldPerKw, panelsForConsumption, planSolar, type SolarPlanInput } from "./solar";

const flatGhi = Array(12).fill(5);
// 5 kWh/m²/day × 365.25 days × 0.75 performance ratio
const flatAnnualYield = 5 * 365.25 * 0.75;

const base: SolarPlanInput = {
  maxPanelsOnRoof: 10,
  monthlyGhi: flatGhi,
  annualConsumptionKwh: 3600,
  tariffPerKwh: 7,
  subsidyCategory: "general",
};

describe("monthlyYieldPerKw", () => {
  it("multiplies irradiance by days in month and the performance ratio", () => {
    const yields = monthlyYieldPerKw(flatGhi);
    expect(yields[0]).toBeCloseTo(5 * 31 * 0.75);
    expect(yields.reduce((a, b) => a + b, 0)).toBeCloseTo(flatAnnualYield);
  });

  it("rejects series that are not 12 non-negative numbers", () => {
    expect(() => monthlyYieldPerKw([5, 5])).toThrow(RangeError);
    expect(() => monthlyYieldPerKw([...Array(11).fill(5), -1])).toThrow(RangeError);
  });

  it("gives 3 to 4.5 units per kW per day for Pune, in line with utility guidance", () => {
    const { monthlyGhi } = parseSolarResource(pune);
    const perDay = monthlyYieldPerKw(monthlyGhi).reduce((a, b) => a + b, 0) / 365.25;
    expect(perDay).toBeGreaterThan(3);
    expect(perDay).toBeLessThan(4.5);
  });
});

describe("panelsForConsumption", () => {
  it("rounds to the nearest panel", () => {
    // 3600 / 1369.69 = 2.63 kW = 4.82 panels of 545 W
    expect(panelsForConsumption(3600, flatAnnualYield)).toBe(5);
  });

  it("returns at least one panel", () => {
    expect(panelsForConsumption(0, flatAnnualYield)).toBe(1);
    expect(panelsForConsumption(100, flatAnnualYield)).toBe(1);
  });
});

describe("planSolar", () => {
  it("sizes to consumption when the roof has room", () => {
    const plan = planSolar(base);
    expect(plan.panels).toBe(5);
    expect(plan.sizedBy).toBe("consumption");
    expect(plan.capacityKw).toBeCloseTo(5 * MODULE_KW);
    expect(plan.annualGenerationKwh).toBeCloseTo(2.725 * flatAnnualYield);
    expect(plan.grossCost).toBe(149_875);
    expect(plan.subsidy).toBe(73_050);
    expect(plan.netCost).toBe(76_825);
    // Generation exceeds consumption, so savings cover all 3600 units at ₹7.
    expect(plan.annualSavings).toBeCloseTo(25_200);
    expect(plan.paybackYears).toBeCloseTo(76_825 / 25_200);
  });

  it("is limited by the roof when consumption needs more panels", () => {
    const plan = planSolar({ ...base, maxPanelsOnRoof: 3 });
    expect(plan.panels).toBe(3);
    expect(plan.sizedBy).toBe("roof");
    expect(plan.panelsForConsumption).toBe(5);
  });

  it("follows a household override, capped by the roof", () => {
    expect(planSolar({ ...base, panelsOverride: 2 })).toMatchObject({ panels: 2, sizedBy: "override" });
    expect(planSolar({ ...base, panelsOverride: 20 })).toMatchObject({ panels: 10, sizedBy: "roof" });
    expect(() => planSolar({ ...base, panelsOverride: 0 })).toThrow(RangeError);
  });

  it("values exported units only at the export rate", () => {
    const withExport = planSolar({ ...base, exportRatePerKwh: 3 });
    const exported = 2.725 * flatAnnualYield - 3600;
    expect(withExport.annualSavings).toBeCloseTo(25_200 + exported * 3);
  });

  it("applies degradation to lifetime savings", () => {
    // Small system that never covers consumption, so every unit is worth the tariff.
    const plan = planSolar({ ...base, panelsOverride: 2 });
    const factor = (1 - (1 - ANNUAL_DEGRADATION) ** LIFETIME_YEARS) / ANNUAL_DEGRADATION;
    expect(plan.lifetimeSavings).toBeCloseTo(plan.annualSavings * factor);
  });

  it("gives no subsidy to connections that aren't residential", () => {
    const plan = planSolar({ ...base, subsidyEligible: false });
    expect(plan.subsidy).toBe(0);
    expect(plan.netCost).toBe(plan.grossCost);
  });

  it("pays only the balance up to 3 kW after an earlier subsidy", () => {
    // 2.725 kW new on top of 1 kW subsidised before: CFA for kW 2 and the first 0.725 of kW 3.
    expect(planSolar({ ...base, priorSubsidisedKw: 1 }).subsidy).toBe(30_000 + 18_000);
    expect(planSolar({ ...base, priorSubsidisedKw: 3 }).subsidy).toBe(0);
  });

  it("uses the special category rate when asked", () => {
    expect(planSolar({ ...base, subsidyCategory: "special" }).subsidy).toBe(80_355);
  });

  it("flags capacity above the sanctioned load", () => {
    expect(planSolar({ ...base, sanctionedLoadKw: 2 }).exceedsSanctionedLoad).toBe(true);
    expect(planSolar({ ...base, sanctionedLoadKw: 5 }).exceedsSanctionedLoad).toBe(false);
    expect(planSolar(base).exceedsSanctionedLoad).toBe(false);
  });

  it("returns an empty plan when no panel fits", () => {
    const plan = planSolar({ ...base, maxPanelsOnRoof: 0 });
    expect(plan).toMatchObject({ panels: 0, capacityKw: 0, subsidy: 0, annualSavings: 0, paybackYears: null });
  });

  it("rejects invalid inputs", () => {
    expect(() => planSolar({ ...base, maxPanelsOnRoof: 2.5 })).toThrow(RangeError);
    expect(() => planSolar({ ...base, tariffPerKwh: -1 })).toThrow(RangeError);
    expect(() => planSolar({ ...base, annualConsumptionKwh: Number.NaN })).toThrow(RangeError);
  });
});
