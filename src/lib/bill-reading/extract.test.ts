import { describe, expect, it } from "vitest";
import { billSchema } from "@/lib/bill";
import { billExtractionSchema, loadInKw, monthsBetween, toBillPrefill, type BillExtraction } from "./extract";

const reading: BillExtraction = {
  isElectricityBill: true,
  discom: "MSEDCL",
  consumerNumber: "170012345678",
  billingPeriodStart: "2026-08-01",
  billingPeriodEnd: "2026-09-01",
  billingMonths: 1,
  unitsConsumed: 245,
  currentCharges: 2140,
  fixedCharges: 128,
  sanctionedLoad: 3,
  sanctionedLoadUnit: "kW",
  tariffCategory: "90 LT I Res 1-Phase",
  connectionType: "residential",
};

describe("monthsBetween", () => {
  it("counts months whichever way the bill writes its period", () => {
    expect(monthsBetween("2026-08-01", "2026-09-01")).toBe(1); // reading dates
    expect(monthsBetween("2026-09-05", "2026-10-04")).toBe(1); // inclusive period
    expect(monthsBetween("2026-07-18", "2026-09-17")).toBe(2);
    expect(monthsBetween("2026-06-01", "2026-08-31")).toBe(3);
  });

  it("rejects periods that can't be one bill", () => {
    expect(monthsBetween("2026-09-01", "2026-09-05")).toBeNull();
    expect(monthsBetween("2026-01-01", "2026-09-01")).toBeNull();
    expect(monthsBetween("2026-09-01", "2026-08-01")).toBeNull();
  });
});

describe("loadInKw", () => {
  it("converts the units bills print", () => {
    expect(loadInKw(3, "kW")).toBe(3);
    expect(loadInKw(2, "kVA")).toBe(2);
    expect(loadInKw(2500, "W")).toBe(2.5);
    expect(loadInKw(1, "HP")).toBe(0.75);
  });

  it("reads an unlabelled number in the hundreds as watts", () => {
    expect(loadInKw(4, null)).toBe(4);
    expect(loadInKw(1500, null)).toBe(1.5);
  });
});

describe("toBillPrefill", () => {
  it("fills every bill field the form needs", () => {
    const prefill = toBillPrefill(reading);
    expect(prefill).toEqual({
      billingMonths: 1,
      unitsOnBill: 245,
      amountRupees: 2140,
      fixedChargesRupees: 128,
      sanctionedLoadKw: 3,
      residential: true,
      discom: "MSEDCL",
      consumerNumber: "170012345678",
    });
    // Together with what the household adds, the prefill passes the form's own validation.
    expect(billSchema.safeParse({ ...prefill, householdSize: 4 }).success).toBe(true);
  });

  it("returns nothing for a document that isn't an electricity bill", () => {
    expect(toBillPrefill({ ...reading, isElectricityBill: false })).toEqual({});
  });

  it("trusts the printed dates over the model's month count", () => {
    expect(toBillPrefill({ ...reading, billingPeriodStart: "2026-06-01", billingPeriodEnd: "2026-08-31", billingMonths: 1 }).billingMonths).toBe(3);
    expect(toBillPrefill({ ...reading, billingPeriodStart: null, billingPeriodEnd: null, billingMonths: 2 }).billingMonths).toBe(2);
  });

  it("drops fixed charges that aren't less than the bill", () => {
    expect(toBillPrefill({ ...reading, fixedCharges: 2140 }).fixedChargesRupees).toBeUndefined();
  });

  it("leaves the connection type alone when the bill doesn't say", () => {
    expect(toBillPrefill({ ...reading, connectionType: "unknown" }).residential).toBeUndefined();
    expect(toBillPrefill({ ...reading, connectionType: "non-residential" }).residential).toBe(false);
  });
});

describe("billExtractionSchema", () => {
  it("turns impossible values into nulls instead of rejecting the reading", () => {
    const parsed = billExtractionSchema.parse({
      ...reading,
      unitsConsumed: -5,
      billingPeriodEnd: "31-08-2026",
      sanctionedLoadUnit: "amps",
      connectionType: "mixed",
    });
    expect(parsed.unitsConsumed).toBeNull();
    expect(parsed.billingPeriodEnd).toBeNull();
    expect(parsed.sanctionedLoadUnit).toBeNull();
    expect(parsed.connectionType).toBe("unknown");
    expect(parsed.currentCharges).toBe(2140);
  });

  it("rejects an answer that isn't a reading at all", () => {
    expect(billExtractionSchema.safeParse({ text: "I can't read this" }).success).toBe(false);
  });
});
