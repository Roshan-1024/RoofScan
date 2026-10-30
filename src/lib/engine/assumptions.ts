/**
 * Every fixed number the engine uses, with where it comes from.
 * docs/METHODOLOGY.md explains how each one is applied.
 */

/** A typical 144 half-cell mono PERC module of the kind used under PM Surya Ghar. */
export const MODULE = {
  watts: 545,
  lengthM: 2.279,
  widthM: 1.134,
} as const;

export const MODULE_KW = MODULE.watts / 1000;

/**
 * Share of the panels' rated output that reaches the meter after inverter,
 * wiring, soiling and high-temperature losses. Indian rooftop systems
 * typically achieve 0.75 to 0.80; 0.75 keeps estimates conservative and
 * matches utility guidance of 3 to 4 units per kW per day.
 */
export const PERFORMANCE_RATIO = 0.75;

/** Yearly output loss of crystalline silicon modules, from typical module warranties. */
export const ANNUAL_DEGRADATION = 0.005;

/** Period over which lifetime savings are counted, matching standard 25-year module warranties. */
export const LIFETIME_YEARS = 25;

/**
 * Installed cost before subsidy, ₹ per kW. Market prices for 1 to 3 kW
 * residential systems run roughly ₹45,000 to ₹65,000 per kW; households can
 * replace this with their vendor's quote.
 */
export const DEFAULT_COST_PER_KW = 55_000;

/**
 * Value of units exported beyond the year's consumption. Net-metering feed-in
 * rates vary by state and are well below retail tariffs, so they are not
 * counted unless the household enters their state's rate.
 */
export const DEFAULT_EXPORT_RATE_PER_KWH = 0;

/** Rule of thumb from utility FAQs: about 10 m² of shadow-free roof per kW. */
export const AREA_PER_KW_M2 = 10;

/** Share of rain on a roof that can be collected; typical roof coefficients are 0.7 to 0.9. */
export const RAINWATER_RUNOFF_COEFFICIENT = 0.8;

/** Urban domestic water norm in litres per person per day (CPHEEO). */
export const WATER_LITRES_PER_PERSON_PER_DAY = 135;

export const DEFAULT_HOUSEHOLD_SIZE = 4;

export const DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
