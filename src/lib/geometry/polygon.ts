export interface Point {
  x: number;
  y: number;
}

export type Polygon = Point[];

/** Unsigned area of a simple polygon (shoelace formula), in squared input units. */
export function polygonArea(polygon: Polygon): number {
  let twiceArea = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    twiceArea += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twiceArea) / 2;
}

/** Rotates `point` by `angleRad` around `origin`. */
export function rotatePoint(point: Point, angleRad: number, origin: Point = { x: 0, y: 0 }): Point {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos };
}

/** Even-odd rule point-in-polygon test. */
export function pointInPolygon(point: Point, polygon: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > point.y !== b.y > point.y) {
      const xCross = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (point.x < xCross) inside = !inside;
    }
  }
  return inside;
}

/**
 * Angle in degrees, in (-45, 45], of the rotation that best aligns the
 * polygon with the axes: the one whose axis-aligned bounding box is
 * smallest. For a rectangular roof this is the angle of its walls.
 */
export function dominantAngle(polygon: Polygon, stepDeg = 0.5): number {
  let bestAngle = 0;
  let bestArea = Number.POSITIVE_INFINITY;
  for (let deg = -45 + stepDeg; deg <= 45 + 1e-9; deg += stepDeg) {
    const rad = (-deg * Math.PI) / 180;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of polygon) {
      const r = rotatePoint(p, rad);
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y);
    }
    const area = (maxX - minX) * (maxY - minY);
    if (area < bestArea - 1e-9) {
      bestArea = area;
      bestAngle = deg;
    }
  }
  return Math.round(bestAngle * 100) / 100;
}
