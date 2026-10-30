import type { NextRequest } from "next/server";
import { NominatimError, searchPlaces } from "@/lib/data/nominatim";
import { clientKey, RateLimiter } from "@/lib/security/rate-limit";
import { isLocale } from "@/i18n/config";

const limiter = new RateLimiter(20, 10 * 60 * 1000);

/** GET /api/geocode?q=Shivaji+Nagar+Pune&lang=en: places in India matching the query. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const lang = request.nextUrl.searchParams.get("lang") ?? "en";

  if (query.length < 3 || query.length > 200) {
    return Response.json({ error: "q must be 3 to 200 characters" }, { status: 400 });
  }
  if (!limiter.allow(clientKey(request))) {
    return Response.json({ error: "Too many searches. Try again in a few minutes." }, { status: 429 });
  }

  try {
    const places = await searchPlaces(query, isLocale(lang) ? lang : "en");
    return Response.json({ places });
  } catch (error) {
    if (error instanceof NominatimError) {
      return Response.json({ error: "Address search is unavailable right now" }, { status: 502 });
    }
    throw error;
  }
}
