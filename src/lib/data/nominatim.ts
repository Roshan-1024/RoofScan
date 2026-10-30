import "server-only";
import { z } from "zod";

/**
 * OpenStreetMap Nominatim geocoding, used within its usage policy
 * (https://operations.osmfoundation.org/policies/nominatim/): an identifying
 * User-Agent, at most one request per second, cached results, and no
 * search-as-you-type (the UI only searches on submit).
 */
const BASE_URL = "https://nominatim.openstreetmap.org";
const MIN_INTERVAL_MS = 1100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 1000;

export class NominatimError extends Error {}

export interface Place {
  id: number;
  label: string;
  lat: number;
  lon: number;
}

export interface Region {
  /** ISO 3166-1 alpha-2 code in lower case, e.g. "in". */
  countryCode?: string;
  state?: string;
  district?: string;
  label: string;
}

const searchSchema = z.array(
  z.object({
    place_id: z.number(),
    lat: z.string(),
    lon: z.string(),
    display_name: z.string(),
  }),
);

const reverseSchema = z.object({
  display_name: z.string(),
  address: z
    .object({
      state: z.string().optional(),
      state_district: z.string().optional(),
      county: z.string().optional(),
      city_district: z.string().optional(),
      country_code: z.string().optional(),
    })
    .partial(),
});

function userAgent(): string {
  const contact = process.env.NOMINATIM_CONTACT_EMAIL;
  return contact ? `RoofScan/0.1 (${contact})` : "RoofScan/0.1";
}

let nextSlot = 0;
/** Spaces requests at least MIN_INTERVAL_MS apart across this server instance. */
async function waitForSlot(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + MIN_INTERVAL_MS;
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
}

const cache = new Map<string, { value: unknown; expires: number }>();

async function getJson(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(path, BASE_URL);
  url.search = new URLSearchParams(params).toString();
  const key = url.toString();
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  await waitForSlot();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": userAgent(), Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (error) {
    throw new NominatimError(`Nominatim request failed: ${(error as Error).message}`);
  }
  if (!response.ok) throw new NominatimError(`Nominatim returned HTTP ${response.status}`);
  const value: unknown = await response.json();

  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Up to five places in India matching `query`. */
export async function searchPlaces(query: string, language: string): Promise<Place[]> {
  const body = await getJson("/search", {
    q: query.trim(),
    format: "jsonv2",
    countrycodes: "in",
    limit: "5",
    "accept-language": language,
  });
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) throw new NominatimError("Unexpected Nominatim search response");
  return parsed.data.map((p) => ({
    id: p.place_id,
    label: p.display_name,
    lat: Number(p.lat),
    lon: Number(p.lon),
  }));
}

/** Country, state and district for a coordinate. */
export async function regionAt(lat: number, lon: number, language: string): Promise<Region> {
  const body = await getJson("/reverse", {
    lat: lat.toFixed(6),
    lon: lon.toFixed(6),
    format: "jsonv2",
    zoom: "10",
    addressdetails: "1",
    "accept-language": language,
  });
  // Points at sea or with no address come back as { error: "Unable to geocode" }: no country.
  if (body && typeof body === "object" && "error" in body) return { label: "" };
  const parsed = reverseSchema.safeParse(body);
  if (!parsed.success) throw new NominatimError("Unexpected Nominatim reverse response");
  const { address, display_name } = parsed.data;
  return {
    countryCode: address.country_code?.toLowerCase(),
    state: address.state,
    district: address.state_district ?? address.county ?? address.city_district,
    label: display_name,
  };
}
