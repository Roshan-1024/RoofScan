import { describe, expect, it } from "vitest";
import { fill, formatNumber, formatRupees } from "./format";

describe("formatting", () => {
  it("groups digits the Indian way", () => {
    expect(formatNumber(123456)).toBe("1,23,456");
    expect(formatRupees(78000)).toBe("₹78,000");
    expect(formatRupees(149875.4)).toBe("₹1,49,875");
  });

  it("keeps the requested decimals", () => {
    expect(formatNumber(0.2832, 2)).toBe("0.28");
  });

  it("fills placeholders and leaves unknown ones alone", () => {
    expect(fill("{value} m per pixel", { value: "0.28" })).toBe("0.28 m per pixel");
    expect(fill("{missing}", {})).toBe("{missing}");
  });
});
