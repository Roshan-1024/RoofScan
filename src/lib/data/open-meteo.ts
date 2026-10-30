import "server-only";
import { z } from "zod";

/**
 * Average annual rainfall at a point from the ECMWF IFS model (about 9 km
 * grid), via the Open-Meteo historical weather API. Free for non-commercial
 * use; data under CC BY 4.0 with attribution.
 * https://open-meteo.com/en/docs/historical-weather-api
 */
const ENDPOINT = "https://archive-api.open-meteo.com/v1/archive";
export const RAINFALL_FIRST_YEAR = 2017;
export const RAINFALL_LAST_YEAR = 2024;
/** A year counts only if nearly every day has data. */
const MIN_DAYS_PER_YEAR = 360;
const MIN_COMPLETE_YEARS = 5;

const responseSchema = z.object({
  daily: z.object({
    time: z.array(z.string()),
    precipitation_sum: z.array(z.number().nullable()),
  }),
});

export interface Rainfall {
  /** Mean of the complete years' totals, mm per year. */
  annualMm: number;
  firstYear: number;
  lastYear: number;
  completeYears: number;
}

export class OpenMeteoError extends Error {}

/** Averages complete calendar years of daily precipitation; exported for tests. */
export function parseRainfall(body: unknown): Rainfall {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new OpenMeteoError("Unexpected Open-Meteo response shape");
  const { time, precipitation_sum: values } = parsed.data.daily;
  if (time.length !== values.length) throw new OpenMeteoError("Open-Meteo returned mismatched series");

  const years = new Map<number, { total: number; days: number }>();
  time.forEach((date, i) => {
    const value = values[i];
    if (value === null || value < 0) return;
    const year = Number(date.slice(0, 4));
    const entry = years.get(year) ?? { total: 0, days: 0 };
    entry.total += value;
    entry.days += 1;
    years.set(year, entry);
  });

  const complete = [...years.entries()].filter(([, e]) => e.days >= MIN_DAYS_PER_YEAR).sort(([a], [b]) => a - b);
  if (complete.length < MIN_COMPLETE_YEARS) {
    throw new OpenMeteoError("Not enough complete years of rainfall data for this location");
  }
  const annualMm = complete.reduce((sum, [, e]) => sum + e.total, 0) / complete.length;
  return {
    annualMm,
    firstYear: complete[0][0],
    lastYear: complete[complete.length - 1][0],
    completeYears: complete.length,
  };
}

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, { value: Rainfall; expires: number }>();

export async function fetchRainfall(lat: number, lon: number): Promise<Rainfall> {
  // The model grid is about 9 km, so 0.05° cells share one upstream request.
  const key = `${(Math.round(lat * 20) / 20).toFixed(2)},${(Math.round(lon * 20) / 20).toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start_date: `${RAINFALL_FIRST_YEAR}-01-01`,
    end_date: `${RAINFALL_LAST_YEAR}-12-31`,
    daily: "precipitation_sum",
    models: "ecmwf_ifs",
    timezone: "Asia/Kolkata",
  }).toString();

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
  } catch (error) {
    throw new OpenMeteoError(`Open-Meteo request failed: ${(error as Error).message}`);
  }
  if (!response.ok) throw new OpenMeteoError(`Open-Meteo returned HTTP ${response.status}`);

  const value = parseRainfall(await response.json());
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}
