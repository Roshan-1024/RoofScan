import "server-only";
import { z } from "zod";

/**
 * Long-term monthly solar irradiance from NASA POWER (Prediction Of
 * Worldwide Energy Resources), climatology endpoint, renewable-energy
 * community. Public, no key required.
 * https://power.larc.nasa.gov/docs/services/api/temporal/climatology/
 */
const ENDPOINT = "https://power.larc.nasa.gov/api/temporal/climatology/point";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
const FILL_VALUE = -999;

const monthlyRecord = z.object(
  Object.fromEntries([...MONTHS, "ANN"].map((key) => [key, z.number()])) as Record<
    (typeof MONTHS)[number] | "ANN",
    z.ZodNumber
  >,
);

const responseSchema = z.object({
  properties: z.object({
    parameter: z.object({ ALLSKY_SFC_SW_DWN: monthlyRecord }),
  }),
});

export interface SolarResource {
  /** Average daily global horizontal irradiance per month, kWh/m²/day, January to December. */
  monthlyGhi: number[];
  /** Annual average of the same, kWh/m²/day. */
  annualGhi: number;
}

export class NasaPowerError extends Error {}

/** Parses a NASA POWER climatology response; exported for tests. */
export function parseSolarResource(body: unknown): SolarResource {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new NasaPowerError("Unexpected NASA POWER response shape");
  const record = parsed.data.properties.parameter.ALLSKY_SFC_SW_DWN;
  const monthlyGhi = MONTHS.map((month) => record[month]);
  if ([...monthlyGhi, record.ANN].some((v) => v === FILL_VALUE || v < 0)) {
    throw new NasaPowerError("NASA POWER has no irradiance data for this location");
  }
  return { monthlyGhi, annualGhi: record.ANN };
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, { value: SolarResource; expires: number }>();

/**
 * NASA POWER's grid is about half a degree, so coordinates are rounded to
 * 0.05° for caching; neighbouring houses share one upstream request.
 */
function cacheKey(lat: number, lon: number): string {
  return `${(Math.round(lat * 20) / 20).toFixed(2)},${(Math.round(lon * 20) / 20).toFixed(2)}`;
}

export async function fetchSolarResource(lat: number, lon: number): Promise<SolarResource> {
  const key = cacheKey(lat, lon);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    parameters: "ALLSKY_SFC_SW_DWN",
    community: "RE",
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    format: "JSON",
  }).toString();

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  } catch (error) {
    throw new NasaPowerError(`NASA POWER request failed: ${(error as Error).message}`);
  }
  if (!response.ok) throw new NasaPowerError(`NASA POWER returned HTTP ${response.status}`);

  const value = parseSolarResource(await response.json());
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}
