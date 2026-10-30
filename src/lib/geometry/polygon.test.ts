import { describe, expect, it } from "vitest";
import { dominantAngle, pointInPolygon, polygonArea, rotatePoint, type Polygon } from "./polygon";

const rect = (w: number, h: number): Polygon => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: h },
  { x: 0, y: h },
];

const rotated = (polygon: Polygon, deg: number): Polygon =>
  polygon.map((p) => rotatePoint(p, (deg * Math.PI) / 180, { x: 5, y: 3 }));

describe("polygonArea", () => {
  it("measures rectangles and L-shapes in either winding", () => {
    expect(polygonArea(rect(10, 6))).toBe(60);
    expect(polygonArea([...rect(10, 6)].reverse())).toBe(60);
    const lShape: Polygon = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(polygonArea(lShape)).toBe(64);
  });

  it("is unchanged by rotation", () => {
    expect(polygonArea(rotated(rect(10, 6), 33))).toBeCloseTo(60, 9);
  });
});

describe("pointInPolygon", () => {
  it("separates inside from outside points", () => {
    expect(pointInPolygon({ x: 5, y: 3 }, rect(10, 6))).toBe(true);
    expect(pointInPolygon({ x: 11, y: 3 }, rect(10, 6))).toBe(false);
    expect(pointInPolygon({ x: -0.1, y: 3 }, rect(10, 6))).toBe(false);
  });
});

describe("dominantAngle", () => {
  it("is 0 for an axis-aligned rectangle", () => {
    expect(dominantAngle(rect(10, 6))).toBe(0);
  });

  it("recovers the rotation of a rotated rectangle", () => {
    expect(dominantAngle(rotated(rect(10, 6), 20))).toBeCloseTo(20, 1);
    expect(dominantAngle(rotated(rect(10, 6), -30))).toBeCloseTo(-30, 1);
  });

  it("folds rotations into the range -45 to 45 degrees", () => {
    expect(dominantAngle(rotated(rect(10, 6), 70))).toBeCloseTo(-20, 1);
  });
});
