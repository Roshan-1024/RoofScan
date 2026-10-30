import {
  ANNUAL_DEGRADATION,
  DAYS_IN_MONTH,
  DEFAULT_COST_PER_KW,
  DEFAULT_EXPORT_RATE_PER_KWH,
  LIFETIME_YEARS,
  MODULE_KW,
  PERFORMANCE_RATIO,
} from "./assumptions";
import { centralSubsidy, type SubsidyCategory } from "./subsidy";

/** Twelve monthly values, January to December. */
export type MonthlySeries = readonly number[];

export interface SolarPlanInput {
  /** Panels that fit on the usable roof, from the layout step. */
  maxPanelsOnRoof: number;
  /** Long-term average daily irradiance per month in kWh/m²/day (NASA POWER), January to December. */
  monthlyGhi: MonthlySeries;
  /** Electricity used in a year, in kWh. */
  annualConsumptionKwh: number;
  /** Average price of a unit on the household's bill, ₹/kWh. */
  tariffPerKwh: number;
  subsidyCategory: SubsidyCategory;
  /** Sanctioned load from the bill, in kW. Used for a warning, not as a cap. */
  sanctionedLoadKw?: number;
  /** Installed cost before subsidy, ₹/kW. */
  costPerKw?: number;
  /** Value of units exported beyond the year's consumption, ₹/kWh. */
  exportRatePerKwh?: number;
  /** Panel count chosen by the household instead of the recommendation. */
  panelsOverride?: number;
}

export type SizingReason = "consumption" | "roof" | "override";

export interface SolarPlan {
  panels: number;
  capacityKw: number;
  /** Which constraint set the panel count. */
  sizedBy: SizingReason;
  /** Panels the household's consumption calls for, before the roof limit. */
  panelsForConsumption: number;
  monthlyGenerationKwh: number[];
  annualGenerationKwh: number;
  /** Units per installed kW per year. */
  specificYieldKwhPerKw: number;
  /** Share of yearly consumption the system covers, 0 to 1 (can exceed 1). */
  consumptionCovered: number;
  grossCost: number;
  subsidy: number;
  netCost: number;
  annualSavings: number;
  /** Years for savings to repay the net cost; null when there are no savings. */
  paybackYears: number | null;
  lifetimeSavings: number;
  /** True when capacity exceeds the sanctioned load, which may need a load increase. */
  exceedsSanctionedLoad: boolean;
}

function assertMonthly(series: MonthlySeries, name: string) {
  if (series.length !== 12 || series.some((v) => !Number.isFinite(v) || v < 0)) {
    throw new RangeError(`${name} must hold 12 non-negative numbers`);
  }
}

/** Expected units per installed kW for each month. */
export function monthlyYieldPerKw(monthlyGhi: MonthlySeries): number[] {
  assertMonthly(monthlyGhi, "monthlyGhi");
  return monthlyGhi.map((ghi, month) => ghi * DAYS_IN_MONTH[month] * PERFORMANCE_RATIO);
}

/** Panels needed to cover a year's consumption, rounded to the nearest panel, at least one. */
export function panelsForConsumption(annualConsumptionKwh: number, annualYieldPerKw: number): number {
  if (annualConsumptionKwh <= 0 || annualYieldPerKw <= 0) return 1;
  const neededKw = annualConsumptionKwh / annualYieldPerKw;
  return Math.max(1, Math.round(neededKw / MODULE_KW));
}

/** Savings in year `year` (0-based), with module degradation and annual net metering. */
function savingsInYear(
  annualGenerationKwh: number,
  annualConsumptionKwh: number,
  tariffPerKwh: number,
  exportRatePerKwh: number,
  year: number,
): number {
  const generation = annualGenerationKwh * (1 - ANNUAL_DEGRADATION) ** year;
  const offset = Math.min(generation, annualConsumptionKwh);
  const exported = Math.max(generation - annualConsumptionKwh, 0);
  return offset * tariffPerKwh + exported * exportRatePerKwh;
}

export function planSolar(input: SolarPlanInput): SolarPlan {
  const {
    maxPanelsOnRoof,
    monthlyGhi,
    annualConsumptionKwh,
    tariffPerKwh,
    subsidyCategory,
    sanctionedLoadKw,
    costPerKw = DEFAULT_COST_PER_KW,
    exportRatePerKwh = DEFAULT_EXPORT_RATE_PER_KWH,
    panelsOverride,
  } = input;

  if (!Number.isInteger(maxPanelsOnRoof) || maxPanelsOnRoof < 0) {
    throw new RangeError("maxPanelsOnRoof must be a non-negative integer");
  }
  if (!(annualConsumptionKwh >= 0) || !(tariffPerKwh >= 0) || !(costPerKw >= 0) || !(exportRatePerKwh >= 0)) {
    throw new RangeError("consumption, tariff, cost and export rate must be non-negative numbers");
  }

  const yieldByMonth = monthlyYieldPerKw(monthlyGhi);
  const annualYieldPerKw = yieldByMonth.reduce((sum, v) => sum + v, 0);
  const forConsumption = panelsForConsumption(annualConsumptionKwh, annualYieldPerKw);

  let panels: number;
  let sizedBy: SizingReason;
  if (panelsOverride !== undefined) {
    if (!Number.isInteger(panelsOverride) || panelsOverride < 1) {
      throw new RangeError("panelsOverride must be a positive integer");
    }
    panels = Math.min(panelsOverride, maxPanelsOnRoof);
    sizedBy = panelsOverride <= maxPanelsOnRoof ? "override" : "roof";
  } else if (forConsumption <= maxPanelsOnRoof) {
    panels = forConsumption;
    sizedBy = "consumption";
  } else {
    panels = maxPanelsOnRoof;
    sizedBy = "roof";
  }

  const capacityKw = panels * MODULE_KW;
  const monthlyGenerationKwh = yieldByMonth.map((perKw) => perKw * capacityKw);
  const annualGenerationKwh = annualYieldPerKw * capacityKw;

  const grossCost = Math.round(capacityKw * costPerKw);
  const subsidy = Math.min(centralSubsidy(capacityKw, subsidyCategory), grossCost);
  const netCost = grossCost - subsidy;

  const annualSavings = savingsInYear(annualGenerationKwh, annualConsumptionKwh, tariffPerKwh, exportRatePerKwh, 0);
  let lifetimeSavings = 0;
  for (let year = 0; year < LIFETIME_YEARS; year++) {
    lifetimeSavings += savingsInYear(annualGenerationKwh, annualConsumptionKwh, tariffPerKwh, exportRatePerKwh, year);
  }

  return {
    panels,
    capacityKw,
    sizedBy,
    panelsForConsumption: forConsumption,
    monthlyGenerationKwh,
    annualGenerationKwh,
    specificYieldKwhPerKw: annualYieldPerKw,
    consumptionCovered: annualConsumptionKwh > 0 ? annualGenerationKwh / annualConsumptionKwh : 0,
    grossCost,
    subsidy,
    netCost,
    annualSavings,
    paybackYears: annualSavings > 0 ? netCost / annualSavings : null,
    lifetimeSavings,
    exceedsSanctionedLoad: sanctionedLoadKw !== undefined && capacityKw > sanctionedLoadKw,
  };
}
