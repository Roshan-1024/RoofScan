/**
 * Central Financial Assistance (CFA) under PM Surya Ghar: Muft Bijli Yojana
 * for individual residential households, as amended by MNRE in July 2025.
 *
 * Source: MNRE operational guidelines for CFA to residential consumers.
 *
 * General category: ₹30,000 per kW for the first 2 kW and ₹18,000 per kW for
 * the third kW. Special category states and UTs receive 10% more: ₹33,000
 * and ₹19,800. Capacity above 3 kW earns no further CFA, so the maximum is
 * ₹78,000 (general) or ₹85,800 (special category). Fractional capacities are
 * pro-rated at the same per-kW rates.
 */

export const SUBSIDY_RATES = {
  general: { firstTwoKwPerKw: 30_000, thirdKwPerKw: 18_000 },
  special: { firstTwoKwPerKw: 33_000, thirdKwPerKw: 19_800 },
} as const;

export const SUBSIDY_CAP_KW = 3;

export type SubsidyCategory = keyof typeof SUBSIDY_RATES;

/** North-Eastern states, hill states and island UTs that get the higher rate. */
const SPECIAL_CATEGORY = new Set(
  [
    "Arunachal Pradesh",
    "Assam",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Sikkim",
    "Tripura",
    "Uttarakhand",
    "Himachal Pradesh",
    "Jammu and Kashmir",
    "Ladakh",
    "Andaman and Nicobar Islands",
    "Lakshadweep",
  ].map(normaliseStateName),
);

function normaliseStateName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

export function subsidyCategoryForState(stateName: string | undefined): SubsidyCategory {
  if (!stateName) return "general";
  return SPECIAL_CATEGORY.has(normaliseStateName(stateName)) ? "special" : "general";
}

/** CFA in rupees for a residential system of `capacityKw`, rounded to the rupee. */
export function centralSubsidy(capacityKw: number, category: SubsidyCategory = "general"): number {
  if (!Number.isFinite(capacityKw) || capacityKw <= 0) return 0;
  const rates = SUBSIDY_RATES[category];
  const firstTwo = Math.min(capacityKw, 2);
  const third = Math.min(Math.max(capacityKw - 2, 0), SUBSIDY_CAP_KW - 2);
  return Math.round(firstTwo * rates.firstTwoKwPerKw + third * rates.thirdKwPerKw);
}

/**
 * CFA for a new system when the household already received CFA for
 * `priorKw` of rooftop solar. The guidelines allow CFA only for the balance
 * up to 3 kW of total subsidised capacity, at the rates of that balance.
 */
export function subsidyAfterPrior(newKw: number, priorKw: number, category: SubsidyCategory = "general"): number {
  const prior = Math.min(Math.max(Number.isFinite(priorKw) ? priorKw : 0, 0), SUBSIDY_CAP_KW);
  if (!Number.isFinite(newKw) || newKw <= 0) return 0;
  return Math.max(centralSubsidy(prior + newKw, category) - centralSubsidy(prior, category), 0);
}
