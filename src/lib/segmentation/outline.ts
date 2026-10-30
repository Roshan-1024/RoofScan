import { contours } from "d3-contour";
import {
  dominantAngle,
  pointInPolygon,
  polygonArea,
  rotatePoint,
  type Point,
  type Polygon,
} from "@/lib/geometry/polygon";

/** A binary mask over part of an image, as SAM returns it: one 0 or 1 per pixel, row by row. */
export interface MaskRaster {
  data: Uint8Array;
  width: number;
  height: number;
  /** The image pixels the raster covers; right and bottom are exclusive. */
  bounds: { left: number; top: number; right: number; bottom: number };
}

/**
 * Sizes below are for a 400 px satellite snapshot (about 0.28 m per pixel)
 * and scale with the image size. They were tuned on SAM 3.1 masks of houses
 * in eight Indian cities.
 */
const REFERENCE_SIZE = 400;
/** How far, in pixels, a simplified outline may stray from the mask's edge: about 1 m. */
const TOLERANCE_PX = 4;
/** Corners closer than this are merged, so every handle can be dragged on a phone. */
const MIN_EDGE_PX = 9;
/** Regions smaller than this are specks, not roofs. */
const MIN_AREA_PX = 60;
/**
 * A shape filling at least this share of its tightest rectangle becomes that
 * rectangle. Masks of plainly rectangular roofs fill 0.85 to 0.9, losing
 * their corners and edges to overhanging trees.
 */
const RECTANGLE_FILL = 0.85;
/** Enough corners for an L- or U-shaped roof while staying easy to edit. */
const MAX_VERTICES = 12;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Douglas–Peucker simplification of an open path; keeps both ends. */
function simplifyPath(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let farthest = -1;
    let farthestDistance = tolerance;
    for (let i = start + 1; i < end; i++) {
      const d = distanceToSegment(points[i], points[start], points[end]);
      if (d > farthestDistance) {
        farthest = i;
        farthestDistance = d;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push([start, farthest], [farthest, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * Douglas–Peucker simplification of a closed ring (without a repeated first
 * point). The ring is split at the vertex farthest from the first, so both
 * halves are open paths with fixed ends.
 */
export function simplifyRing(ring: Polygon, tolerance: number): Polygon {
  if (ring.length <= 3) return ring;
  let split = 1;
  for (let i = 2; i < ring.length; i++) {
    if (distance(ring[0], ring[i]) > distance(ring[0], ring[split])) split = i;
  }
  const first = simplifyPath(ring.slice(0, split + 1), tolerance);
  const second = simplifyPath([...ring.slice(split), ring[0]], tolerance);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

/** Area of the triangle a corner forms with its neighbours: what removing it would change. */
function cornerWeight(ring: Polygon, i: number): number {
  const a = ring[(i - 1 + ring.length) % ring.length];
  const b = ring[i];
  const c = ring[(i + 1) % ring.length];
  return Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
}

/**
 * Merges corners joined by edges shorter than `minEdge`, then trims the ring
 * to `maxVertices`, each time dropping the corner whose removal changes the
 * shape least. Never goes below four corners.
 */
export function tidyCorners(ring: Polygon, minEdge: number, maxVertices: number): Polygon {
  const result = [...ring];
  const dropLeastImportant = (candidates: number[]) => {
    const drop = candidates.reduce((best, i) => (cornerWeight(result, i) < cornerWeight(result, best) ? i : best));
    result.splice(drop, 1);
  };
  while (result.length > 4) {
    let shortest = -1;
    for (let i = 0; i < result.length; i++) {
      const length = distance(result[i], result[(i + 1) % result.length]);
      if (length < minEdge && (shortest === -1 || length < distance(result[shortest], result[(shortest + 1) % result.length]))) {
        shortest = i;
      }
    }
    if (shortest === -1) break;
    dropLeastImportant([shortest, (shortest + 1) % result.length]);
  }
  while (result.length > Math.max(maxVertices, 4)) {
    dropLeastImportant(result.map((_, i) => i));
  }
  return result;
}

/** The smallest rectangle around the polygon, aligned with its walls (see `dominantAngle`). */
export function wallAlignedRectangle(polygon: Polygon): Polygon {
  const angle = (dominantAngle(polygon) * Math.PI) / 180;
  const aligned = polygon.map((p) => rotatePoint(p, -angle));
  const xs = aligned.map((p) => p.x);
  const ys = aligned.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ].map((p) => rotatePoint(p, angle));
}

/** Outer edges of every region in the mask, in image pixels. Holes are ignored. */
function outerRings(mask: MaskRaster): Polygon[] {
  const { data, width, height, bounds } = mask;
  // The raster may be coarser than the box it covers.
  const scaleX = (bounds.right - bounds.left) / width;
  const scaleY = (bounds.bottom - bounds.top) / height;
  const [regions] = contours().size([width, height]).thresholds([0.5])(Array.from(data));
  return regions.coordinates.map(([outer]) =>
    // d3-contour repeats the first point at the end.
    outer.slice(0, -1).map(([x, y]) => ({ x: bounds.left + x * scaleX, y: bounds.top + y * scaleY })),
  );
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Turns a segmentation mask into a roof outline a household can edit: the
 * region under `point` (or else the largest), simplified to a few corners,
 * and squared off when it is essentially a rectangle. Returns null when the
 * mask holds nothing big enough to be a roof.
 */
export function maskToOutline(mask: MaskRaster, point: Point, imageSize: number): Polygon | null {
  const scale = imageSize / REFERENCE_SIZE;
  const regions = outerRings(mask).filter((ring) => ring.length >= 3 && polygonArea(ring) >= MIN_AREA_PX * scale * scale);
  if (regions.length === 0) return null;

  const ring =
    regions.find((candidate) => pointInPolygon(point, candidate)) ??
    regions.reduce((largest, candidate) => (polygonArea(candidate) > polygonArea(largest) ? candidate : largest));

  const rectangle = wallAlignedRectangle(ring);
  let outline: Polygon;
  if (polygonArea(ring) >= RECTANGLE_FILL * polygonArea(rectangle)) {
    outline = rectangle;
  } else {
    outline = tidyCorners(simplifyRing(ring, TOLERANCE_PX * scale), MIN_EDGE_PX * scale, MAX_VERTICES);
  }

  const clamp = (value: number) => round(Math.min(Math.max(value, 0), imageSize));
  return outline.map((p) => ({ x: clamp(p.x), y: clamp(p.y) }));
}
