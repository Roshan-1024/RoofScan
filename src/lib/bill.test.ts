import { describe, expect, it } from "vitest";
import { annualConsumptionKwh, billSchema, isUnusualTariff, maskConsumerNumber, tariffPerKwh, type BillDetails } from "./bill";

const bill: BillDetails = {
  unitsOnBill: 480,
  billingMonths: 2,
  amountRupees: 3_960,
  fixedChargesRupees: 240,
  residential: true,
  householdSize: 4,
};

describe("bill", () => {
  it("annualises consumption from the billing period", () => {
    expect(annualConsumptionKwh(bill)).toBe(2880);
    expect(annualConsumptionKwh({ ...bill, billingMonths: 1 })).toBe(5760);
  });

  it("works out the price per unit without fixed charges", () => {
    expect(tariffPerKwh(bill)).toBeCloseTo((3960 - 240) / 480);
    expect(tariffPerKwh({ ...bill, fixedChargesRupees: undefined })).toBeCloseTo(3960 / 480);
  });

  it("flags tariffs outside the residential range", () => {
    expect(isUnusualTariff(7.75)).toBe(false);
    expect(isUnusualTariff(0.5)).toBe(true);
    expect(isUnusualTariff(45)).toBe(true);
  });

  it("masks all but the last four characters of a consumer number", () => {
    expect(maskConsumerNumber("1700 1234 5678")).toBe("••••5678");
    expect(maskConsumerNumber("123")).toBe("••••");
  });

  it("validates bill details", () => {
    expect(billSchema.safeParse(bill).success).toBe(true);
    expect(billSchema.safeParse({ ...bill, unitsOnBill: 0 }).success).toBe(false);
    expect(billSchema.safeParse({ ...bill, billingMonths: 4 }).success).toBe(false);
    expect(billSchema.safeParse({ ...bill, fixedChargesRupees: 5000 }).success).toBe(false);
    expect(billSchema.safeParse({ ...bill, householdSize: 0 }).success).toBe(false);
  });

  it("only flags fixed charges against a valid bill amount", () => {
    const paths = (candidate: object) =>
      billSchema.safeParse(candidate).error?.issues.map((issue) => issue.path.join("."));
    // An empty form: the amount is missing, the optional fixed charges are not wrong.
    expect(paths({ ...bill, amountRupees: 0, fixedChargesRupees: undefined })).toEqual(["amountRupees"]);
    expect(paths({ ...bill, amountRupees: Number.NaN, fixedChargesRupees: 240 })).toEqual(["amountRupees"]);
    expect(paths({ ...bill, amountRupees: 200, fixedChargesRupees: 240 })).toEqual(["fixedChargesRupees"]);
  });
});
