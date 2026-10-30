import { describe, expect, it } from "vitest";
import { polygonArea, pointInPolygon, rotatePoint, type Polygon } from "@/lib/geometry/polygon";
import { maskToOutline, simplifyRing, tidyCorners, wallAlignedRectangle, type MaskRaster } from "./outline";

const SIZE = 400;

/** A mask like SAM's: a full-resolution raster over the box around the pixels `inside` accepts. */
function mask(inside: (x: number, y: number) => boolean, imageSize = SIZE): MaskRaster {
  let [left, top, right, bottom] = [imageSize, imageSize, 0, 0];
  for (let y = 0; y < imageSize; y++) {
    for (let x = 0; x < imageSize; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  if (right <= left) return { data: new Uint8Array(1), width: 1, height: 1, bounds: { left: 0, top: 0, right: 1, bottom: 1 } };
  const width = right - left;
  const height = bottom - top;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = inside(left + x + 0.5, top + y + 0.5) ? 1 : 0;
  }
  return { data, width, height, bounds: { left, top, right, bottom } };
}

const inPolygon = (polygon: Polygon) => (x: number, y: number) => pointInPolygon({ x, y }, polygon);
const rectangle = (x: number, y: number, w: number, h: number): Polygon => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

describe("maskToOutline", () => {
  it("turns a rectangular roof into its four corners", () => {
    const outline = maskToOutline(mask(inPolygon(rectangle(100, 120, 40, 30))), { x: 120, y: 135 }, SIZE)!;
    expect(outline).toHaveLength(4);
    expect(polygonArea(outline)).toBeCloseTo(1200, -1.5);
    const xs = outline.map((p) => p.x).sort((a, b) => a - b);
    const ys = outline.map((p) => p.y).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(100, 0);
    expect(xs[3]).toBeCloseTo(140, 0);
    expect(ys[0]).toBeCloseTo(120, 0);
    expect(ys[3]).toBeCloseTo(150, 0);
  });

  it("keeps a rotated rectangle's angle and area", () => {
    const centre = { x: 200, y: 200 };
    const rotated = rectangle(170, 180, 60, 40).map((p) => rotatePoint(p, (25 * Math.PI) / 180, centre));
    const outline = maskToOutline(mask(inPolygon(rotated)), centre, SIZE)!;
    expect(outline).toHaveLength(4);
    expect(Math.abs(polygonArea(outline) - 2400) / 2400).toBeLessThan(0.04);
  });

  it("follows an L-shaped roof instead of squaring it off", () => {
    const shape: Polygon = [
      { x: 100, y: 100 },
      { x: 180, y: 100 },
      { x: 180, y: 140 },
      { x: 140, y: 140 },
      { x: 140, y: 200 },
      { x: 100, y: 200 },
    ];
    const outline = maskToOutline(mask(inPolygon(shape)), { x: 120, y: 150 }, SIZE)!;
    expect(outline.length).toBeGreaterThanOrEqual(6);
    expect(outline.length).toBeLessThanOrEqual(10);
    expect(Math.abs(polygonArea(outline) - polygonArea(shape)) / polygonArea(shape)).toBeLessThan(0.04);
  });

  it("picks the region under the tapped point", () => {
    const big = rectangle(20, 20, 120, 120);
    const small = rectangle(250, 250, 30, 30);
    const both = (x: number, y: number) => inPolygon(big)(x, y) || inPolygon(small)(x, y);
    expect(polygonArea(maskToOutline(mask(both), { x: 265, y: 265 }, SIZE)!)).toBeCloseTo(900, -2);
    // Away from both, the largest region wins.
    expect(polygonArea(maskToOutline(mask(both), { x: 200, y: 200 }, SIZE)!)).toBeCloseTo(14_400, -3);
  });

  it("returns null for an empty mask or a speck", () => {
    expect(maskToOutline(mask(() => false), { x: 200, y: 200 }, SIZE)).toBeNull();
    expect(maskToOutline(mask(inPolygon(rectangle(200, 200, 5, 5))), { x: 202, y: 202 }, SIZE)).toBeNull();
  });

  it("scales a raster that is coarser than the box it covers", () => {
    const coarse: MaskRaster = {
      data: new Uint8Array(20 * 15).fill(1),
      width: 20,
      height: 15,
      bounds: { left: 100, top: 100, right: 140, bottom: 130 },
    };
    const outline = maskToOutline(coarse, { x: 120, y: 115 }, SIZE)!;
    expect(polygonArea(outline)).toBeCloseTo(1200, -2);
  });

  it("keeps ragged edges down to a few draggable corners", () => {
    // A blob with a bumpy edge, like a roof under overhanging trees.
    const blob = (x: number, y: number) => {
      const angle = Math.atan2(y - 200, x - 200);
      return Math.hypot(x - 200, y - 200) < 60 + 6 * Math.sin(angle * 9) + 3 * Math.cos(angle * 23);
    };
    const outline = maskToOutline(mask(blob), { x: 200, y: 200 }, SIZE)!;
    expect(outline.length).toBeGreaterThanOrEqual(3);
    expect(outline.length).toBeLessThanOrEqual(12);
  });

  it("keeps corners inside the image", () => {
    const outline = maskToOutline(mask(inPolygon(rectangle(0, 0, 60, 50))), { x: 10, y: 10 }, SIZE)!;
    for (const p of outline) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(SIZE);
      expect(p.y).toBeLessThanOrEqual(SIZE);
    }
  });

  it("scales its tolerances with the image size", () => {
    // The same 2 m roof detail in an 800 px photo still counts as a roof.
    const outline = maskToOutline(mask(inPolygon(rectangle(300, 300, 80, 60)), 800), { x: 340, y: 330 }, 800)!;
    expect(polygonArea(outline)).toBeCloseTo(4800, -2);
  });
});

describe("simplifyRing", () => {
  it("drops points along straight edges", () => {
    const ring: Polygon = [];
    for (let i = 0; i < 10; i++) ring.push({ x: i * 10, y: 0 });
    for (let i = 0; i < 10; i++) ring.push({ x: 100, y: i * 10 });
    for (let i = 10; i > 0; i--) ring.push({ x: i * 10, y: 100 });
    for (let i = 10; i > 0; i--) ring.push({ x: 0, y: i * 10 });
    const simplified = simplifyRing(ring, 1);
    expect(simplified).toHaveLength(4);
    expect(polygonArea(simplified)).toBeCloseTo(10_000);
  });
});

describe("tidyCorners", () => {
  it("merges corners that are too close to drag apart", () => {
    const square: Polygon = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 102, y: 3 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const tidy = tidyCorners(square, 9, 12);
    expect(tidy).toHaveLength(4);
    expect(polygonArea(tidy)).toBeCloseTo(10_000, -2);
  });

  it("trims to the most important corners", () => {
    const circle: Polygon = Array.from({ length: 40 }, (_, i) => ({
      x: 100 + 50 * Math.cos((i / 40) * 2 * Math.PI),
      y: 100 + 50 * Math.sin((i / 40) * 2 * Math.PI),
    }));
    expect(tidyCorners(circle, 1, 12)).toHaveLength(12);
  });

  it("never goes below four corners", () => {
    const tiny: Polygon = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 0, y: 3 },
      { x: 0, y: 1.5 },
    ];
    expect(tidyCorners(tiny, 9, 12)).toHaveLength(4);
  });
});

describe("wallAlignedRectangle", () => {
  it("fits a rotated square exactly", () => {
    const square = rectangle(0, 0, 10, 10).map((p) => rotatePoint(p, (20 * Math.PI) / 180));
    expect(polygonArea(wallAlignedRectangle(square))).toBeCloseTo(100, 1);
  });
});
