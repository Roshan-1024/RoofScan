import {
  EDGE_SETBACK_M,
  MODULE,
  MODULE_GAP_M,
  OBSTACLE_CLEARANCE_M,
  PANEL_TILT_DEG,
} from "@/lib/engine/assumptions";
import { dominantAngle, pointInPolygon, polygonArea, rotatePoint, type Point, type Polygon } from "@/lib/geometry/polygon";

/**
 * Fits solar panels onto a roof outline.
 *
 * The roof and its obstacles are rotated so the roof's walls line up with
 * the axes, then rasterised on a fine grid in metres. Edges are shrunk by a
 * walkway setback and obstacles grown by a clearance. Panels are placed in
 * rows along one roof axis, tilted towards the other, with rows spaced so
 * they don't shade each other between 9:00 and 15:00 solar time on the
 * winter solstice, the usual design rule for Indian rooftop systems.
 * Portrait and landscape mounting are both tried, along with row offsets,
 * and the arrangement holding the most panels wins.
 */

export type MountOrientation = "portrait" | "landscape";

export interface RoofLayoutInput {
  /** Roof outline in image pixels. */
  roof: Polygon;
  /** Areas panels can't go on, in image pixels. */
  obstacles: Polygon[];
  metersPerPixel: number;
  /** Site latitude, which sets the sun's height and so the row spacing. */
  latitude: number;
}

export interface RoofLayout {
  /** Plan area inside the roof outline, m². */
  roofAreaM2: number;
  /** Area left for panels after setbacks and obstacle clearance, m². */
  usableAreaM2: number;
  panelCount: number;
  /** Each panel's footprint in image pixels, four corners. */
  panels: Polygon[];
  orientation: MountOrientation;
  /** Rotation of the panel rows relative to the image axes, degrees. */
  rowAngleDeg: number;
}

const EMPTY: RoofLayout = {
  roofAreaM2: 0,
  usableAreaM2: 0,
  panelCount: 0,
  panels: [],
  orientation: "portrait",
  rowAngleDeg: 0,
};

const BASE_CELL_M = 0.05;
const MAX_CELLS = 2_000_000;
const ROW_OFFSET_STEP_M = 0.2;

const DEG = Math.PI / 180;
const WINTER_SOLSTICE_DECLINATION = -23.44 * DEG;
/** Rows must not shade each other from this many hours either side of solar noon. */
const SHADE_FREE_HOURS_FROM_NOON = 3;

/**
 * Length of shadow cast towards the next row (north-south component) per
 * metre of height, at 9:00 or 15:00 solar time on the winter solstice, when
 * the sun is lowest within the shade-free window.
 */
export function winterShadowFactor(latitude: number): number {
  const lat = Math.abs(latitude) * DEG;
  const hourAngle = SHADE_FREE_HOURS_FROM_NOON * 15 * DEG;
  const sinElevation =
    Math.sin(lat) * Math.sin(WINTER_SOLSTICE_DECLINATION) +
    Math.cos(lat) * Math.cos(WINTER_SOLSTICE_DECLINATION) * Math.cos(hourAngle);
  const elevation = Math.asin(Math.max(sinElevation, Math.sin(5 * DEG)));
  const cosAzimuth =
    (Math.sin(elevation) * Math.sin(lat) - Math.sin(WINTER_SOLSTICE_DECLINATION)) / (Math.cos(elevation) * Math.cos(lat));
  return Math.min(Math.max(cosAzimuth, 0), 1) / Math.tan(elevation);
}

/** Row footprint depth and centre-to-centre pitch for a module edge of `alongTiltM`. */
export function rowGeometry(alongTiltM: number, latitude: number, tiltDeg = PANEL_TILT_DEG) {
  const tilt = tiltDeg * DEG;
  const depth = alongTiltM * Math.cos(tilt);
  const height = alongTiltM * Math.sin(tilt);
  return { depth, pitch: depth + height * winterShadowFactor(latitude) };
}

/** Square dilation of a binary grid by `radius` cells, as two 1-D passes. */
function dilate(grid: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return grid.slice();
  const horizontal = new Uint8Array(grid.length);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let lastOn = -Infinity;
    for (let x = 0; x < width; x++) {
      if (grid[row + x]) lastOn = x;
      if (x - lastOn <= radius) horizontal[row + x] = 1;
    }
    lastOn = Infinity;
    for (let x = width - 1; x >= 0; x--) {
      if (grid[row + x]) lastOn = x;
      if (lastOn - x <= radius) horizontal[row + x] = 1;
    }
  }
  const out = new Uint8Array(grid.length);
  for (let x = 0; x < width; x++) {
    let lastOn = -Infinity;
    for (let y = 0; y < height; y++) {
      if (horizontal[y * width + x]) lastOn = y;
      if (y - lastOn <= radius) out[y * width + x] = 1;
    }
    lastOn = Infinity;
    for (let y = height - 1; y >= 0; y--) {
      if (horizontal[y * width + x]) lastOn = y;
      if (lastOn - y <= radius) out[y * width + x] = 1;
    }
  }
  return out;
}

export function layoutPanels({ roof, obstacles, metersPerPixel, latitude }: RoofLayoutInput): RoofLayout {
  if (roof.length < 3 || !(metersPerPixel > 0)) return EMPTY;

  const toMeters = (p: Point): Point => ({ x: p.x * metersPerPixel, y: p.y * metersPerPixel });
  const roofM = roof.map(toMeters);
  const roofAreaM2 = polygonArea(roofM);
  if (roofAreaM2 <= 0) return EMPTY;

  // Rotate so the roof's walls are axis-aligned.
  const rowAngleDeg = dominantAngle(roofM);
  const angle = (-rowAngleDeg * Math.PI) / 180;
  const roofR = roofM.map((p) => rotatePoint(p, angle));
  const obstaclesR = obstacles
    .filter((o) => o.length >= 3)
    .map((o) => o.map((p) => rotatePoint(toMeters(p), angle)));

  // Grid over the rotated roof's bounding box, with a one-cell border.
  const minX = Math.min(...roofR.map((p) => p.x));
  const maxX = Math.max(...roofR.map((p) => p.x));
  const minY = Math.min(...roofR.map((p) => p.y));
  const maxY = Math.max(...roofR.map((p) => p.y));
  const cell = Math.max(BASE_CELL_M, Math.sqrt(((maxX - minX) * (maxY - minY)) / MAX_CELLS));
  const width = Math.ceil((maxX - minX) / cell) + 2;
  const height = Math.ceil((maxY - minY) / cell) + 2;
  const originX = minX - cell;
  const originY = minY - cell;

  const outside = new Uint8Array(width * height);
  const blocked = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const center = { x: originX + (x + 0.5) * cell, y: originY + (y + 0.5) * cell };
      const i = y * width + x;
      if (!pointInPolygon(center, roofR)) outside[i] = 1;
      else if (obstaclesR.some((o) => pointInPolygon(center, o))) blocked[i] = 1;
    }
  }

  const edgeBuffer = dilate(outside, width, height, Math.round(EDGE_SETBACK_M / cell));
  const obstacleBuffer = dilate(blocked, width, height, Math.round(OBSTACLE_CLEARANCE_M / cell));
  const usable = new Uint8Array(width * height);
  let usableCells = 0;
  for (let i = 0; i < usable.length; i++) {
    if (!edgeBuffer[i] && !obstacleBuffer[i]) {
      usable[i] = 1;
      usableCells++;
    }
  }

  // Summed-area table: any rectangle's usable cell count in O(1).
  const sat = new Uint32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += usable[y * width + x];
      sat[(y + 1) * (width + 1) + x + 1] = sat[y * (width + 1) + x + 1] + rowSum;
    }
  }
  const rectFits = (x0: number, y0: number, x1: number, y1: number): boolean => {
    const cx0 = Math.floor((x0 - originX) / cell);
    const cy0 = Math.floor((y0 - originY) / cell);
    const cx1 = Math.ceil((x1 - originX) / cell);
    const cy1 = Math.ceil((y1 - originY) / cell);
    if (cx0 < 0 || cy0 < 0 || cx1 > width || cy1 > height) return false;
    const count =
      sat[cy1 * (width + 1) + cx1] - sat[cy0 * (width + 1) + cx1] - sat[cy1 * (width + 1) + cx0] + sat[cy0 * (width + 1) + cx0];
    return count === (cx1 - cx0) * (cy1 - cy0);
  };

  let best: { orientation: MountOrientation; rects: Array<[number, number, number, number]> } = {
    orientation: "portrait",
    rects: [],
  };

  for (const orientation of ["portrait", "landscape"] as const) {
    // Portrait: the module's long edge runs up the tilt; landscape: along the row.
    const alongRow = orientation === "portrait" ? MODULE.widthM : MODULE.lengthM;
    const alongTilt = orientation === "portrait" ? MODULE.lengthM : MODULE.widthM;
    const { depth, pitch } = rowGeometry(alongTilt, latitude);

    for (let offset = 0; offset < pitch; offset += ROW_OFFSET_STEP_M) {
      const rects: Array<[number, number, number, number]> = [];
      for (let y = minY + offset; y + depth <= maxY + 1e-9; y += pitch) {
        let x = minX;
        while (x + alongRow <= maxX + 1e-9) {
          if (rectFits(x, y, x + alongRow, y + depth)) {
            rects.push([x, y, x + alongRow, y + depth]);
            x += alongRow + MODULE_GAP_M;
          } else {
            x += cell;
          }
        }
      }
      if (rects.length > best.rects.length) best = { orientation, rects };
    }
  }

  const fromRotatedMeters = (p: Point): Point => {
    const r = rotatePoint(p, -angle);
    return { x: r.x / metersPerPixel, y: r.y / metersPerPixel };
  };
  const panels = best.rects.map(([x0, y0, x1, y1]) =>
    [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ].map(fromRotatedMeters),
  );

  return {
    roofAreaM2,
    usableAreaM2: usableCells * cell * cell,
    panelCount: panels.length,
    panels,
    orientation: best.orientation,
    rowAngleDeg,
  };
}
