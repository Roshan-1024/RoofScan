/**
 * Bounding box around India, including Andaman & Nicobar and Lakshadweep.
 * PM Surya Ghar only covers India, so requests outside it are rejected early.
 */
export const INDIA_BOUNDS = {
  minLat: 6.4,
  maxLat: 37.6,
  minLon: 68.0,
  maxLon: 97.5,
} as const;

export function isInIndiaBounds(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= INDIA_BOUNDS.minLat &&
    lat <= INDIA_BOUNDS.maxLat &&
    lon >= INDIA_BOUNDS.minLon &&
    lon <= INDIA_BOUNDS.maxLon
  );
}
