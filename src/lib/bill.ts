import { z } from "zod";

/**
 * What RoofScan needs from an electricity bill. Households type these in, or
 * (once bill reading lands) confirm values read from a photo.
 */
export const billSchema = z
  .object({
    /** Units (kWh) consumed in the billing period. */
    unitsOnBill: z.number().positive().max(100_000),
    billingMonths: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    /** Charges for this bill only, without arrears or late fees, ₹. */
    amountRupees: z.number().positive().max(10_00_000),
    /** Fixed or demand charges included in the amount, ₹. */
    fixedChargesRupees: z.number().min(0).max(10_00_000).optional(),
    sanctionedLoadKw: z.number().positive().max(1000).optional(),
    residential: z.boolean(),
    discom: z.string().trim().max(120).optional(),
    consumerNumber: z.string().trim().max(40).optional(),
    householdSize: z.number().int().min(1).max(30),
    /** Rooftop solar the household already received a central subsidy for, kW. */
    priorSubsidisedKw: z.number().min(0).max(100).optional(),
  })
  // Only compared once the amount itself is valid, so an empty form doesn't
  // also flag the optional fixed charges.
  .refine((b) => !(b.amountRupees > 0) || (b.fixedChargesRupees ?? 0) < b.amountRupees, {
    path: ["fixedChargesRupees"],
    message: "fixed charges must be less than the bill amount",
  });

export type BillDetails = z.infer<typeof billSchema>;

export function annualConsumptionKwh(bill: BillDetails): number {
  return (bill.unitsOnBill / bill.billingMonths) * 12;
}

/** Average price per unit after removing fixed charges, which solar doesn't reduce. */
export function tariffPerKwh(bill: BillDetails): number {
  return (bill.amountRupees - (bill.fixedChargesRupees ?? 0)) / bill.unitsOnBill;
}

/** Residential tariffs in India fall roughly between ₹2 and ₹15 per unit. */
export function isUnusualTariff(tariff: number): boolean {
  return tariff < 1.5 || tariff > 20;
}

/** Shows only the last four characters: "••••5678". */
export function maskConsumerNumber(value: string): string {
  const clean = value.replace(/\s+/g, "");
  if (clean.length <= 4) return "••••";
  return `••••${clean.slice(-4)}`;
}
