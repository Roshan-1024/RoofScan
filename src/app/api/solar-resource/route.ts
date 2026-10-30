import type { NextRequest } from "next/server";
import { fetchSolarResource, NasaPowerError } from "@/lib/data/nasa-power";
import { isInIndiaBounds } from "@/lib/geo/india";

/**
 * GET /api/solar-resource?lat=18.52&lon=73.86
 * Monthly solar irradiance for a location in India, from NASA POWER.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));

  if (!params.has("lat") || !params.has("lon") || !isInIndiaBounds(lat, lon)) {
    return Response.json({ error: "lat and lon must be a location in India" }, { status: 400 });
  }

  try {
    const resource = await fetchSolarResource(lat, lon);
    return Response.json(
      { ...resource, units: "kWh/m²/day", source: "NASA POWER" },
      { headers: { "Cache-Control": "public, max-age=86400" } },
    );
  } catch (error) {
    if (error instanceof NasaPowerError) {
      return Response.json({ error: "Solar data is unavailable right now" }, { status: 502 });
    }
    throw error;
  }
}
