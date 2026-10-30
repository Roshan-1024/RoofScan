/** State and district for the chosen location, from GET /api/region. */
export interface Region {
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
