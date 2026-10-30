/**
 * Web Mercator (EPSG:3857) helpers for 256 px map tiles, as used by Esri
 * World Imagery and most web maps.
 */

export const TILE_SIZE = 256;
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

export interface PixelPoint {
  x: number;
  y: number;
}

/** Position of a coordinate in the global pixel grid at `zoom`. */
export function latLonToGlobalPixel(lat: number, lon: number, zoom: number): PixelPoint {
  const scale = TILE_SIZE * 2 ** zoom;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

export function globalPixelToLatLon(x: number, y: number, zoom: number): { lat: number; lon: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const lon = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lon };
}

/** Ground distance covered by one pixel at `lat` and `zoom`, in metres. */
export function metersPerPixel(lat: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (TILE_SIZE * 2 ** zoom);
}

export interface TileWindow {
  /** Global pixel position of the window's top-left corner. */
  left: number;
  top: number;
  size: number;
  zoom: number;
  /** Tiles that cover the window, with where each one is drawn inside it. */
  tiles: Array<{ x: number; y: number; offsetX: number; offsetY: number }>;
}

/** A square window of `size` pixels centred on a coordinate, and the tiles that cover it. */
export function tileWindow(lat: number, lon: number, zoom: number, size: number): TileWindow {
  const center = latLonToGlobalPixel(lat, lon, zoom);
  const left = Math.round(center.x - size / 2);
  const top = Math.round(center.y - size / 2);
  const tiles: TileWindow["tiles"] = [];
  for (let ty = Math.floor(top / TILE_SIZE); ty <= Math.floor((top + size - 1) / TILE_SIZE); ty++) {
    for (let tx = Math.floor(left / TILE_SIZE); tx <= Math.floor((left + size - 1) / TILE_SIZE); tx++) {
      tiles.push({ x: tx, y: ty, offsetX: tx * TILE_SIZE - left, offsetY: ty * TILE_SIZE - top });
    }
  }
  return { left, top, size, zoom, tiles };
}
