import { describe, expect, it } from "vitest";
import pune from "./__fixtures__/nasa-power-pune.json";
import { NasaPowerError, parseSolarResource } from "./nasa-power";

describe("parseSolarResource", () => {
  it("reads twelve monthly values and the annual average", () => {
    const resource = parseSolarResource(pune);
    expect(resource.monthlyGhi).toHaveLength(12);
    expect(resource.monthlyGhi[0]).toBe(4.9891);
    expect(resource.monthlyGhi[6]).toBe(3.3101);
    expect(resource.annualGhi).toBe(5.1348);
  });

  it("rejects NASA's fill value for missing data", () => {
    const missing = structuredClone(pune);
    missing.properties.parameter.ALLSKY_SFC_SW_DWN.JUL = -999;
    expect(() => parseSolarResource(missing)).toThrow(NasaPowerError);
  });

  it("rejects an unexpected response shape", () => {
    expect(() => parseSolarResource({ messages: ["error"] })).toThrow(NasaPowerError);
  });
});
