import type { NextRequest } from "next/server";
import { fetchRainfall, OpenMeteoError } from "@/lib/data/open-meteo";
import { isInIndiaBounds } from "@/lib/geo/india";
import { clientKey, RateLimiter } from "@/lib/security/rate-limit";

const limiter = new RateLimiter(20, 10 * 60 * 1000);

/** GET /api/rainfall?lat=18.52&lon=73.86: average annual rainfall at a location in India. */
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
    const rainfall = await fetchRainfall(lat, lon);
    return Response.json(
      { ...rainfall, source: "ECMWF IFS via Open-Meteo" },
      { headers: { "Cache-Control": "public, max-age=86400" } },
    );
  } catch (error) {
    if (error instanceof OpenMeteoError) {
      return Response.json({ error: "Rainfall data is unavailable right now" }, { status: 502 });
    }
    throw error;
  }
}
