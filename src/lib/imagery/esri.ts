import { latLonToGlobalPixel, metersPerPixel, TILE_SIZE, tileWindow } from "@/lib/geo/tiles";

/**
 * Esri World Imagery, loaded directly by the visitor's browser (the tile
 * server allows cross-origin reads, so RoofScan's servers never proxy or
 * store imagery). Attribution must stay visible wherever imagery is shown.
 */
const SERVICE = "https://server.arcgisonline.com/ArcGIS/rest/services";

export const ESRI_IMAGERY_TILES = `${SERVICE}/World_Imagery/MapServer/tile/{z}/{y}/{x}`;
export const ESRI_LABEL_TILES = `${SERVICE}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`;
export const ESRI_ATTRIBUTION =
  "Powered by Esri. Imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

/** Highest zoom Esri offers anywhere in India; most cities have imagery to here. */
export const MAX_IMAGERY_ZOOM = 19;
/** Below this a house is too few pixels across to outline reliably. */
export const MIN_IMAGERY_ZOOM = 18;

export class ImageryError extends Error {}

/** Coarsest zoom the map falls back to when looking for real imagery. */
const MIN_DISPLAY_ZOOM = 13;

const availability = new Map<string, boolean>();

/**
 * Whether Esri has real imagery for the tile at a location and zoom, from
 * the service's tile map. Missing tiles are served as a "Map data not yet
 * available" placeholder, so they can't be detected from the tile itself.
 */
async function hasImagery(lat: number, lon: number, zoom: number): Promise<boolean> {
  const { x, y } = latLonToGlobalPixel(lat, lon, zoom);
  const tileX = Math.floor(x / TILE_SIZE);
  const tileY = Math.floor(y / TILE_SIZE);
  const key = `${zoom}/${tileY}/${tileX}`;
  const cached = availability.get(key);
  if (cached !== undefined) return cached;

  const response = await fetch(`${SERVICE}/World_Imagery/MapServer/tilemap/${zoom}/${tileY}/${tileX}/1/1`);
  if (!response.ok) throw new ImageryError(`Tile map returned HTTP ${response.status}`);
  const body = (await response.json()) as { data?: number[] };
  const available = body.data?.[0] === 1;
  if (availability.size > 2000) availability.clear();
  availability.set(key, available);
  return available;
}

/** Highest zoom with real imagery at a location, from `from` down to `to`; null if none. */
async function highestZoomWithImagery(lat: number, lon: number, from: number, to: number): Promise<number | null> {
  for (let zoom = from; zoom >= to; zoom--) {
    if (await hasImagery(lat, lon, zoom)) return zoom;
  }
  return null;
}

/**
 * Zoom to measure a roof at: the highest with real imagery, or null when
 * nothing down to MIN_IMAGERY_ZOOM has imagery.
 */
export function bestImageryZoom(lat: number, lon: number): Promise<number | null> {
  return highestZoomWithImagery(lat, lon, MAX_IMAGERY_ZOOM, MIN_IMAGERY_ZOOM);
}

/**
 * Highest zoom the map should load tiles from at a location. The map
 * enlarges these tiles when zoomed in further, instead of showing
 * placeholders.
 */
export async function displayImageryZoom(lat: number, lon: number): Promise<number> {
  return (await highestZoomWithImagery(lat, lon, MAX_IMAGERY_ZOOM, MIN_DISPLAY_ZOOM)) ?? MIN_DISPLAY_ZOOM;
}

export interface RoofSnapshot {
  /** JPEG data URL of the roof image. */
  dataUrl: string;
  /** Width and height in pixels (square). */
  size: number;
  /** Map zoom of satellite imagery; null for an uploaded photo. */
  zoom: number | null;
  metersPerPixel: number;
  /** The tapped location. For satellite imagery it sits at the centre pixel. */
  center: { lat: number; lon: number };
  /** Esri satellite imagery, or the household's own calibrated photo. */
  source: "esri" | "upload";
}

function loadTile(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ImageryError(`Could not load tile ${url}`));
    image.src = url;
  });
}

/**
 * Snapshot width in pixels. About 113 m across at zoom 19 in central India:
 * enough context around a house, while keeping the roof large on screen.
 */
export const SNAPSHOT_SIZE = 400;

/** Stitches a square of imagery centred on the tapped point. Browser only. */
export async function captureSnapshot(lat: number, lon: number, zoom: number, size = SNAPSHOT_SIZE): Promise<RoofSnapshot> {
  const window = tileWindow(lat, lon, zoom, size);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new ImageryError("Canvas is not available");

  const tiles = await Promise.all(
    window.tiles.map(async (tile) => ({
      tile,
      image: await loadTile(
        ESRI_IMAGERY_TILES.replace("{z}", String(zoom)).replace("{y}", String(tile.y)).replace("{x}", String(tile.x)),
      ),
    })),
  );
  for (const { tile, image } of tiles) context.drawImage(image, tile.offsetX, tile.offsetY);

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.92),
    size,
    zoom,
    metersPerPixel: metersPerPixel(lat, zoom),
    center: { lat, lon },
    source: "esri",
  };
}
