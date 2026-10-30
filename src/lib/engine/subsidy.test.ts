import { describe, expect, it } from "vitest";
import { centralSubsidy, subsidyCategoryForState } from "./subsidy";

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
