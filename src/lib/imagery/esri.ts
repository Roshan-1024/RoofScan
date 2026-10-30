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

/**
 * Highest zoom with real imagery at a location, using the service's tile
 * map (missing tiles return a "Map data not yet available" placeholder).
 * Returns null when no zoom down to MIN_IMAGERY_ZOOM has imagery.
 */
export async function bestImageryZoom(lat: number, lon: number): Promise<number | null> {
  for (let zoom = MAX_IMAGERY_ZOOM; zoom >= MIN_IMAGERY_ZOOM; zoom--) {
    const { x, y } = latLonToGlobalPixel(lat, lon, zoom);
    const url = `${SERVICE}/World_Imagery/MapServer/tilemap/${zoom}/${Math.floor(y / TILE_SIZE)}/${Math.floor(x / TILE_SIZE)}/1/1`;
    const response = await fetch(url);
    if (!response.ok) throw new ImageryError(`Tile map returned HTTP ${response.status}`);
    const body = (await response.json()) as { data?: number[] };
    if (body.data?.[0] === 1) return zoom;
  }
  return null;
}

export interface RoofSnapshot {
  /** JPEG data URL of the stitched imagery. */
  dataUrl: string;
  /** Width and height in pixels (square). */
  size: number;
  zoom: number;
  metersPerPixel: number;
  /** The tapped location, which sits at the centre pixel. */
  center: { lat: number; lon: number };
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
  };
}
