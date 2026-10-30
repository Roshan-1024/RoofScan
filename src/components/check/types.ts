import type { Polygon } from "@/lib/geometry/polygon";
import type { RoofLayout } from "@/lib/layout/panels";

/** Country, state and district for the chosen location, from GET /api/region. */
export interface Region {
  /** Lower-case ISO country code; RoofScan only continues for "in". */
  countryCode?: string;
  state?: string;
  district?: string;
  label: string;
}

export interface LatLon {
  lat: number;
  lon: number;
}

/** Where the map should move to, and how close. */
export interface MapView extends LatLon {
  zoom: number;
}

/** The finished roof outline and the panel layout that fits it. */
export interface RoofState {
  roof: Polygon;
  obstacles: Polygon[];
  layout: RoofLayout;
}

/** Average annual rainfall, from GET /api/rainfall. */
export interface RainfallData {
  annualMm: number;
  firstYear: number;
  lastYear: number;
}

/** Location data the plan needs, loaded as soon as a roof is chosen. */
export type SiteResources =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; monthlyGhi: number[]; rainfall: RainfallData | null };
