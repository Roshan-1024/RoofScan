import {
  DEFAULT_HOUSEHOLD_SIZE,
  RAINWATER_RUNOFF_COEFFICIENT,
  WATER_LITRES_PER_PERSON_PER_DAY,
} from "./assumptions";

export interface RainwaterInput {
  /** Plan area of the whole roof (catchment) in m². */
  roofAreaM2: number;
  /** Long-term average annual rainfall in mm. */
  annualRainfallMm: number;
  householdSize?: number;
}

export interface RainwaterEstimate {
  /** Litres a year the roof can collect. 1 mm of rain on 1 m² is 1 litre. */
  annualLitres: number;
  /** How many days of the household's water use that equals. */
  householdDays: number;
}

export function estimateRainwater({
  roofAreaM2,
  annualRainfallMm,
  householdSize = DEFAULT_HOUSEHOLD_SIZE,
}: RainwaterInput): RainwaterEstimate {
  if (!(roofAreaM2 >= 0) || !(annualRainfallMm >= 0) || !(householdSize > 0)) {
    throw new RangeError("roof area and rainfall must be non-negative, household size positive");
  }
  const annualLitres = roofAreaM2 * annualRainfallMm * RAINWATER_RUNOFF_COEFFICIENT;
  const dailyUse = householdSize * WATER_LITRES_PER_PERSON_PER_DAY;
  return { annualLitres, householdDays: annualLitres / dailyUse };
}
