import { describe, expect, it } from "vitest";
import { rotatePoint, polygonArea, type Polygon } from "@/lib/geometry/polygon";
import { layoutPanels, rowGeometry, winterShadowFactor } from "./panels";

const PUNE_LAT = 18.52;

const rect = (x: number, y: number, w: number, h: number): Polygon => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

const rotateAll = (polygon: Polygon, deg: number): Polygon =>
  polygon.map((p) => rotatePoint(p, (deg * Math.PI) / 180, { x: 50, y: 50 }));

describe("winterShadowFactor", () => {
  // Reference values computed independently from the solar position equations:
  // at 9:00 on 21 December the sun in Pune is 29.26° high, 48.04° east of south.
  it("matches the 9:00 winter-solstice sun in Pune, Delhi and Thiruvananthapuram", () => {
    expect(winterShadowFactor(PUNE_LAT)).toBeCloseTo(1.1932, 3);
    expect(winterShadowFactor(28.6)).toBeCloseTo(1.7401, 3);
    expect(winterShadowFactor(8.5)).toBeCloseTo(0.8395, 3);
  });
});

describe("rowGeometry", () => {
  it("spaces rows so they stay shade-free from 9:00 to 15:00 on the winter solstice", () => {
    // Portrait, 15° tilt in Pune: depth 2.279·cos15° = 2.201 m and
    // height 0.590 m, which casts 0.704 m of shadow towards the next row.
    const { depth, pitch } = rowGeometry(2.279, PUNE_LAT);
    expect(depth).toBeCloseTo(2.2013, 3);
    expect(pitch).toBeCloseTo(2.9052, 3);
    expect(rowGeometry(1.134, PUNE_LAT).pitch).toBeCloseTo(1.4456, 3);
  });

  it("needs wider spacing further north, where the winter sun is lower", () => {
    expect(rowGeometry(2.279, 28.6).pitch).toBeCloseTo(3.2277, 3);
  });
});

describe("layoutPanels", () => {
  // 1 pixel = 1 m keeps the arithmetic readable.
  const roof = rect(45, 47, 10, 6);
  const base = { roof, obstacles: [], metersPerPixel: 1, latitude: PUNE_LAT };

  it("fits nine landscape panels on a 10 m × 6 m roof", () => {
    // After 0.6 m setbacks, 8.8 m × 4.8 m is usable. Landscape: 3 panels of
    // 2.279 m per row and rows every 1.446 m, so 3 rows. Portrait rows are
    // 2.905 m apart, so only one row of 7 fits.
    const layout = layoutPanels(base);
    expect(layout.roofAreaM2).toBe(60);
    expect(layout.usableAreaM2).toBeGreaterThan(8.6 * 4.6);
    expect(layout.usableAreaM2).toBeLessThan(9 * 5);
    expect(layout.panelCount).toBe(9);
    expect(layout.orientation).toBe("landscape");
  });

  it("keeps every panel inside the roof", () => {
    for (const panel of layoutPanels(base).panels) {
      for (const corner of panel) {
        expect(corner.x).toBeGreaterThanOrEqual(45.6 - 0.06);
        expect(corner.x).toBeLessThanOrEqual(54.4 + 0.06);
        expect(corner.y).toBeGreaterThanOrEqual(47.6 - 0.06);
        expect(corner.y).toBeLessThanOrEqual(52.4 + 0.06);
      }
    }
  });

  it("gives the same answer for a rotated roof, and reports the rotation", () => {
    const layout = layoutPanels({ ...base, roof: rotateAll(roof, 20) });
    expect(layout.panelCount).toBe(9);
    expect(layout.rowAngleDeg).toBeCloseTo(20, 1);
    expect(polygonArea(layout.panels[0])).toBeCloseTo(2.279 * 1.134 * Math.cos((15 * Math.PI) / 180), 2);
  });

  it("scales from pixels to metres", () => {
    const half = layoutPanels({
      ...base,
      roof: roof.map((p) => ({ x: p.x * 2, y: p.y * 2 })),
      metersPerPixel: 0.5,
    });
    expect(half.roofAreaM2).toBeCloseTo(60, 9);
    expect(half.panelCount).toBe(9);
  });

  it("leaves room around an obstacle", () => {
    const withTank = layoutPanels({ ...base, obstacles: [rect(49, 49, 1.5, 1.5)] });
    expect(withTank.panelCount).toBeLessThan(9);
    expect(withTank.usableAreaM2).toBeLessThan(layoutPanels(base).usableAreaM2);
  });

  it("returns nothing for a roof too small for a panel", () => {
    expect(layoutPanels({ ...base, roof: rect(45, 47, 2, 2) }).panelCount).toBe(0);
  });

  it("returns an empty layout for fewer than three points or no scale", () => {
    expect(layoutPanels({ ...base, roof: roof.slice(0, 2) }).panelCount).toBe(0);
    expect(layoutPanels({ ...base, metersPerPixel: 0 }).roofAreaM2).toBe(0);
  });
});
