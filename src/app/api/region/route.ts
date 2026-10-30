import type { NextRequest } from "next/server";
import { NominatimError, regionAt } from "@/lib/data/nominatim";
import { isInIndiaBounds } from "@/lib/geo/india";
import { clientKey, RateLimiter } from "@/lib/security/rate-limit";

// Checked on every pin drop, so allow more than the search route.
const limiter = new RateLimiter(60, 10 * 60 * 1000);

/**
 * GET /api/region?lat=18.52&lon=73.86: country, state and district for a
 * location. The caller checks the country, because India's bounding box also
 * covers parts of neighbouring countries. Always English, so state names
 * match the subsidy rules.
 */
export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));

  if (!isInIndiaBounds(lat, lon)) {
    return Response.json({ error: "lat and lon must be a location in India" }, { status: 400 });
  }
  if (!limiter.allow(clientKey(request))) {
    return Response.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }

  try {
    return Response.json(await regionAt(lat, lon, "en"));
  } catch (error) {
    if (error instanceof NominatimError) {
      return Response.json({ error: "Location lookup is unavailable right now" }, { status: 502 });
    }
    throw error;
  }
}
