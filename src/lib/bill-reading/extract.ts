import { z } from "zod";
import type { BillDetails } from "@/lib/bill";

/**
 * What Muse Spark reads from a bill. Only the fields the plan needs: never
 * the household's name or address.
 */
const LOAD_UNITS = ["kW", "kVA", "W", "HP"] as const;
const CONNECTION_TYPES = ["residential", "non-residential", "unknown"] as const;

/** JSON Schema for the model's structured output (strict: every field required, nulls for missing values). */
export const BILL_EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "isElectricityBill",
    "discom",
    "consumerNumber",
    "billingPeriodStart",
    "billingPeriodEnd",
    "billingMonths",
    "unitsConsumed",
    "currentCharges",
    "fixedCharges",
    "sanctionedLoad",
    "sanctionedLoadUnit",
    "tariffCategory",
    "connectionType",
  ],
  properties: {
    isElectricityBill: { type: "boolean" },
    discom: { type: ["string", "null"] },
    consumerNumber: { type: ["string", "null"] },
    billingPeriodStart: { type: ["string", "null"], description: "YYYY-MM-DD" },
    billingPeriodEnd: { type: ["string", "null"], description: "YYYY-MM-DD" },
    billingMonths: { type: ["integer", "null"] },
    unitsConsumed: { type: ["number", "null"] },
    currentCharges: { type: ["number", "null"] },
    fixedCharges: { type: ["number", "null"] },
    sanctionedLoad: { type: ["number", "null"] },
    sanctionedLoadUnit: { type: ["string", "null"], enum: [...LOAD_UNITS, null] },
    tariffCategory: { type: ["string", "null"] },
    connectionType: { type: "string", enum: [...CONNECTION_TYPES] },
  },
} as const;

/** Instructions sent with every bill. Rules for each field live here, not in the schema. */
export const BILL_READING_INSTRUCTIONS = `You read Indian electricity bills for RoofScan, which sizes rooftop solar for households. Extract only the fields in the schema, from this bill. Use null for anything the bill doesn't show. Never guess.

- isElectricityBill: true for an electricity bill, including sample or specimen bills. False for anything else, such as a water or gas bill, a receipt, or a photo that isn't a bill; then set every other field to null and connectionType to "unknown".
- discom: the electricity company's name, in the short form if one is printed.
- consumerNumber: the number the household uses to pay this bill or apply for a connection change: the consumer, account, CA, K or service number, with the bill's own spacing and dashes. If the bill shows both an account number and an RR, meter or connection ID, use the account number.
- billingPeriodStart and billingPeriodEnd: the period this bill covers, from the billing period or from the previous and current meter reading dates. Format YYYY-MM-DD; Indian bills write dates day first.
- billingMonths: how many months the bill covers: 1, 2 or 3.
- unitsConsumed: units (kWh) billed for this period: current minus previous reading, times the multiplying factor, or the billed or net units if printed. Never a cumulative meter reading.
- currentCharges: charges for this billing period only, in rupees, usually labelled current bill, current demand, current month bill or bill amount: energy, fixed or demand charges, fuel adjustment, duty and taxes, after any subsidy for this period. Exclude arrears and previous balance, late payment surcharge, interest, payments received, and discounts for paying early. If only a total that includes arrears is printed, subtract the arrears.
- fixedCharges: fixed, demand or service charges for this period, in rupees.
- sanctionedLoad and sanctionedLoadUnit: the sanctioned, contract or connected load and its unit.
- tariffCategory: the tariff or category as printed.
- connectionType: "residential" for domestic or residential tariffs (for example LT-I Residential, Domestic, LMV-1, LA1A, RGP), "non-residential" for commercial, industrial, agricultural and other categories, "unknown" if the bill doesn't say.

Write numbers as plain numbers, without currency symbols or thousands separators. Ignore names and addresses.`;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(value)));

/** Validates the model's answer. Out-of-range values become null rather than failing the whole reading. */
const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().catch(null);

export const billExtractionSchema = z.object({
  isElectricityBill: z.boolean(),
  discom: nullable(z.string().trim().min(1).max(120)),
  consumerNumber: nullable(z.string().trim().min(1).max(40)),
  billingPeriodStart: nullable(isoDate),
  billingPeriodEnd: nullable(isoDate),
  billingMonths: nullable(z.number().int().min(1).max(3)),
  unitsConsumed: nullable(z.number().positive().max(100_000)),
  currentCharges: nullable(z.number().positive().max(10_00_000)),
  fixedCharges: nullable(z.number().min(0).max(10_00_000)),
  sanctionedLoad: nullable(z.number().positive().max(100_000)),
  sanctionedLoadUnit: nullable(z.enum(LOAD_UNITS)),
  tariffCategory: nullable(z.string().trim().min(1).max(120)),
  connectionType: z.enum(CONNECTION_TYPES).catch("unknown"),
});

export type BillExtraction = z.infer<typeof billExtractionSchema>;

/** Bill fields a reading can fill in. Household size and earlier subsidies aren't on bills. */
export type BillPrefill = Partial<
  Pick<
    BillDetails,
    | "unitsOnBill"
    | "billingMonths"
    | "amountRupees"
    | "fixedChargesRupees"
    | "sanctionedLoadKw"
    | "residential"
    | "discom"
    | "consumerNumber"
  >
>;

const DAY_MS = 24 * 60 * 60 * 1000;
const AVERAGE_MONTH_DAYS = 30.44;

/**
 * Months between two bill dates. Bills write the period either inclusively
 * (05/09 to 04/10) or as reading dates (01/08 to 01/09); both round to the
 * same number of months.
 */
export function monthsBetween(start: string, end: string): 1 | 2 | 3 | null {
  const days = (Date.parse(end) - Date.parse(start)) / DAY_MS;
  if (!Number.isFinite(days) || days < 20 || days > 100) return null;
  return Math.min(3, Math.max(1, Math.round(days / AVERAGE_MONTH_DAYS))) as 1 | 2 | 3;
}

/** Converts a sanctioned load to kW. Residential power factor is close to 1, so 1 kVA counts as 1 kW. */
export function loadInKw(value: number, unit: (typeof LOAD_UNITS)[number] | null): number | null {
  switch (unit) {
    case "W":
      return value / 1000;
    case "HP":
      return Math.round(value * 0.746 * 100) / 100;
    case "kW":
    case "kVA":
      return value;
    default:
      // Unlabelled: residential loads are a few kW, so a number in the hundreds or more is watts.
      return value >= 100 ? value / 1000 : value;
  }
}

const roundRupees = (value: number) => Math.round(value * 100) / 100;

/**
 * Turns a validated reading into values for the bill form, checking that
 * they hang together. Values that don't are left for the household to type.
 */
export function toBillPrefill(reading: BillExtraction): BillPrefill {
  if (!reading.isElectricityBill) return {};
  const prefill: BillPrefill = {};

  const months =
    reading.billingPeriodStart && reading.billingPeriodEnd
      ? (monthsBetween(reading.billingPeriodStart, reading.billingPeriodEnd) ?? reading.billingMonths)
      : reading.billingMonths;
  if (months === 1 || months === 2 || months === 3) prefill.billingMonths = months;

  if (reading.unitsConsumed !== null) prefill.unitsOnBill = Math.round(reading.unitsConsumed * 100) / 100;
  if (reading.currentCharges !== null) prefill.amountRupees = roundRupees(reading.currentCharges);
  if (reading.fixedCharges !== null && (prefill.amountRupees === undefined || reading.fixedCharges < prefill.amountRupees)) {
    prefill.fixedChargesRupees = roundRupees(reading.fixedCharges);
  }

  if (reading.sanctionedLoad !== null) {
    const kw = loadInKw(reading.sanctionedLoad, reading.sanctionedLoadUnit);
    if (kw !== null && kw > 0 && kw <= 1000) prefill.sanctionedLoadKw = kw;
  }
  if (reading.connectionType !== "unknown") prefill.residential = reading.connectionType === "residential";
  if (reading.discom) prefill.discom = reading.discom;
  if (reading.consumerNumber) prefill.consumerNumber = reading.consumerNumber;
  return prefill;
}
