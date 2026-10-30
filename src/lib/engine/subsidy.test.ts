import { describe, expect, it } from "vitest";
import { centralSubsidy, subsidyAfterPrior, subsidyCategoryForState } from "./subsidy";

describe("centralSubsidy", () => {
  it("pays ₹30,000 per kW for the first 2 kW and ₹18,000 for the third", () => {
    expect(centralSubsidy(1)).toBe(30_000);
    expect(centralSubsidy(2)).toBe(60_000);
    expect(centralSubsidy(3)).toBe(78_000);
  });

  it("pro-rates fractional capacity", () => {
    expect(centralSubsidy(2.5)).toBe(69_000);
    expect(centralSubsidy(2.725)).toBe(73_050);
  });

  it("stops at 3 kW", () => {
    expect(centralSubsidy(4.36)).toBe(78_000);
    expect(centralSubsidy(10)).toBe(78_000);
  });

  it("pays 10% more in special category states, up to ₹85,800", () => {
    expect(centralSubsidy(1.09, "special")).toBe(35_970);
    expect(centralSubsidy(3, "special")).toBe(85_800);
    expect(centralSubsidy(5, "special")).toBe(85_800);
  });

  it("returns 0 for zero or invalid capacity", () => {
    expect(centralSubsidy(0)).toBe(0);
    expect(centralSubsidy(-1)).toBe(0);
    expect(centralSubsidy(Number.NaN)).toBe(0);
  });
});

describe("subsidyCategoryForState", () => {
  it("recognises special category states and UTs", () => {
    expect(subsidyCategoryForState("Assam")).toBe("special");
    expect(subsidyCategoryForState("  uttarakhand ")).toBe("special");
    expect(subsidyCategoryForState("Jammu & Kashmir")).toBe("special");
    expect(subsidyCategoryForState("Andaman & Nicobar Islands")).toBe("special");
  });

  it("treats every other state, and a missing one, as general", () => {
    expect(subsidyCategoryForState("Maharashtra")).toBe("general");
    expect(subsidyCategoryForState("Delhi")).toBe("general");
    expect(subsidyCategoryForState(undefined)).toBe("general");
  });
});

describe("subsidyAfterPrior", () => {
  // Worked examples from MNRE's operational guidelines (section 5(n)).
  it("pays only the balance up to 3 kW when 1 kW was subsidised before", () => {
    // 1 kW subsidised earlier, total raised to 4 kW (3 kW new): CFA for 2 kW, ₹48,000.
    expect(subsidyAfterPrior(3, 1)).toBe(48_000);
  });

  it("pays nothing once 3 kW has been subsidised", () => {
    expect(subsidyAfterPrior(2, 3)).toBe(0);
    expect(subsidyAfterPrior(2, 5)).toBe(0);
  });

  it("matches the normal subsidy with nothing subsidised before", () => {
    expect(subsidyAfterPrior(2.5, 0)).toBe(69_000);
    expect(subsidyAfterPrior(2.5, Number.NaN)).toBe(69_000);
  });

  it("uses the special category rates for the balance", () => {
    expect(subsidyAfterPrior(3, 1, "special")).toBe(33_000 + 19_800);
  });
});
