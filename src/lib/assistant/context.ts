import { z } from "zod";
import {
  ANNUAL_DEGRADATION,
  DEFAULT_EXPORT_RATE_PER_KWH,
  LIFETIME_YEARS,
  MODULE,
  PERFORMANCE_RATIO,
} from "@/lib/engine/assumptions";
import { estimateRainwater } from "@/lib/engine/rainwater";
import { planSolar, type SolarPlan } from "@/lib/engine/solar";
import { SUBSIDY_CAP_KW, SUBSIDY_RATES } from "@/lib/engine/subsidy";

/**
 * What the plan view sends with a question: the inputs of the household's
 * plan. Never the consumer number, address or coordinates. The server
 * recalculates the plan from these, so the assistant's numbers come from
 * RoofScan's own engine. Limits only keep requests sane: values the
 * household typed, such as an unusual price, must still pass.
 */
export const planContextSchema = z.object({
  state: z.string().trim().max(80).optional(),
  subsidyCategory: z.enum(["general", "special"]),
  roofAreaM2: z.number().positive().max(100_000),
  usableAreaM2: z.number().min(0).max(100_000),
  /** Panels that fit on the roof. */
  maxPanels: z.number().int().min(1).max(5000),
  annualConsumptionKwh: z.number().positive().max(10_000_000),
  /** Average price per unit after fixed charges, ₹/kWh. */
  tariffPerKwh: z.number().min(0).max(10_00_000),
  sanctionedLoadKw: z.number().positive().max(1000).optional(),
  residential: z.boolean(),
  priorSubsidisedKw: z.number().min(0).max(100).optional(),
  householdSize: z.number().int().min(1).max(30),
  monthlyGhi: z.array(z.number().min(0).max(15)).length(12),
  costPerKw: z.number().positive().max(1_00_00_000),
  /** Panels in the plan the household is looking at. */
  panels: z.number().int().min(1).max(5000),
  rainfallMm: z.number().positive().max(1_00_000).nullable(),
});

export type PlanContext = z.infer<typeof planContextSchema>;

/** The plan for `panels` panels, or the household's current choice. */
export function planFor(context: PlanContext, panels = context.panels): SolarPlan {
  return planSolar({
    maxPanelsOnRoof: context.maxPanels,
    monthlyGhi: context.monthlyGhi,
    annualConsumptionKwh: context.annualConsumptionKwh,
    tariffPerKwh: context.tariffPerKwh,
    subsidyCategory: context.subsidyCategory,
    subsidyEligible: context.residential,
    priorSubsidisedKw: context.priorSubsidisedKw,
    sanctionedLoadKw: context.sanctionedLoadKw,
    costPerKw: context.costPerKw,
    panelsOverride: Math.min(Math.max(1, Math.round(panels)), context.maxPanels),
  });
}

/** A plan in round numbers, as the assistant reads it. */
export function summarisePlan(context: PlanContext, plan: SolarPlan) {
  return {
    panels: plan.panels,
    capacityKw: Math.round(plan.capacityKw * 100) / 100,
    unitsPerYear: Math.round(plan.annualGenerationKwh),
    shareOfUseCoveredPercent: Math.round(plan.consumptionCovered * 100),
    costBeforeSubsidyRupees: plan.grossCost,
    subsidyRupees: plan.subsidy,
    costAfterSubsidyRupees: plan.netCost,
    savingsFirstYearRupees: Math.round(plan.annualSavings),
    paybackYears: plan.paybackYears === null ? null : Math.round(plan.paybackYears * 10) / 10,
    savingsOver25YearsRupees: Math.round(plan.lifetimeSavings),
    exceedsSanctionedLoad: plan.exceedsSanctionedLoad,
    mostPanelsThatFit: context.maxPanels,
  };
}

const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

/** Everything the assistant may state about this household, as plain text for its instructions. */
export function planFacts(context: PlanContext): string {
  const current = summarisePlan(context, planFor(context));
  const recommended = planSolar({
    maxPanelsOnRoof: context.maxPanels,
    monthlyGhi: context.monthlyGhi,
    annualConsumptionKwh: context.annualConsumptionKwh,
    tariffPerKwh: context.tariffPerKwh,
    subsidyCategory: context.subsidyCategory,
    subsidyEligible: context.residential,
    priorSubsidisedKw: context.priorSubsidisedKw,
    sanctionedLoadKw: context.sanctionedLoadKw,
    costPerKw: context.costPerKw,
  });
  const rain =
    context.rainfallMm === null
      ? null
      : estimateRainwater({
          roofAreaM2: context.roofAreaM2,
          annualRainfallMm: context.rainfallMm,
          householdSize: context.householdSize,
        });

  return [
    `State: ${context.state ?? "not known"}. Subsidy rates for this state: ${context.subsidyCategory === "special" ? "special category" : "general category"}.`,
    `Connection: ${context.residential ? "residential, so eligible for the PM Surya Ghar subsidy" : "not residential, so not eligible for the PM Surya Ghar subsidy"}.`,
    context.priorSubsidisedKw ? `Already received subsidy for ${context.priorSubsidisedKw} kW earlier.` : "",
    `Roof: ${Math.round(context.roofAreaM2)} m², of which ${Math.round(context.usableAreaM2)} m² can take panels; at most ${context.maxPanels} panels of ${MODULE.watts} W fit.`,
    `Electricity use: ${Math.round(context.annualConsumptionKwh)} units a year, about ${Math.round(context.annualConsumptionKwh / 12)} a month, at ${rupees(context.tariffPerKwh)} per unit after fixed charges.`,
    context.sanctionedLoadKw ? `Sanctioned load: ${context.sanctionedLoadKw} kW.` : "Sanctioned load: not given.",
    `Installation cost used: ${rupees(context.costPerKw)} per kW before subsidy.`,
    `RoofScan's recommendation: ${recommended.panels} panels (${(Math.round(recommended.capacityKw * 100) / 100).toFixed(2)} kW), sized ${recommended.sizedBy === "roof" ? "to fill the roof" : "to cover the household's use"}.`,
    `The plan the household is looking at: ${JSON.stringify(current)}.`,
    rain
      ? `Rainwater: about ${Math.round(context.rainfallMm!)} mm of rain a year here; the roof can collect about ${Math.round(rain.annualLitres).toLocaleString("en-IN")} litres a year, about ${Math.round(rain.householdDays)} days of water for ${context.householdSize} people.`
      : "Rainwater: rainfall for this place isn't known.",
  ]
    .filter(Boolean)
    .join("\n");
}

const general = SUBSIDY_RATES.general;
const special = SUBSIDY_RATES.special;

/** Scheme rules and RoofScan's assumptions, from MNRE's guidelines and docs/METHODOLOGY.md. */
export const SCHEME_FACTS = [
  `PM Surya Ghar: Muft Bijli Yojana gives central financial assistance (subsidy) for rooftop solar on residential electricity connections only.`,
  `Subsidy: ₹${general.firstTwoKwPerKw.toLocaleString("en-IN")} per kW for the first 2 kW and ₹${general.thirdKwPerKw.toLocaleString("en-IN")} for the third kW, at most ₹78,000. Special category states and UTs (the North-East, Uttarakhand, Himachal Pradesh, Jammu and Kashmir, Ladakh, Andaman and Nicobar, Lakshadweep) get ₹${special.firstTwoKwPerKw.toLocaleString("en-IN")} and ₹${special.thirdKwPerKw.toLocaleString("en-IN")}, at most ₹85,800. Capacity above ${SUBSIDY_CAP_KW} kW gets no more subsidy.`,
  `A household gets the subsidy once; if it received some earlier, only the balance up to ${SUBSIDY_CAP_KW} kW is paid.`,
  `Panels must be DCR: made in India with Indian-made cells.`,
  `How to apply: register on the national portal pmsuryaghar.gov.in with state, DISCOM, consumer number and mobile number; apply for rooftop solar; wait for the DISCOM's feasibility approval; install through a vendor registered on the portal; apply for net metering; the DISCOM inspects and commissions the system; then submit bank details and a cancelled cheque on the portal, and the subsidy is paid into the bank account.`,
  `The scheme is open until 31 March 2027.`,
  `RoofScan's assumptions: performance ratio ${PERFORMANCE_RATIO}, panels lose ${ANNUAL_DEGRADATION * 100}% output a year, ${LIFETIME_YEARS}-year life, sunlight from NASA POWER long-term averages, savings value each unit the household would otherwise buy at its price per unit, and exported units are valued at ₹${DEFAULT_EXPORT_RATE_PER_KWH} to stay cautious. Fixed charges don't change with solar.`,
  `These are estimates. A registered vendor's site survey and the DISCOM's approval decide the final system.`,
].join("\n");
