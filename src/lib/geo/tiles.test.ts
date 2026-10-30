import { describe, expect, it } from "vitest";
import { globalPixelToLatLon, latLonToGlobalPixel, metersPerPixel, TILE_SIZE, tileWindow } from "./tiles";

describe("Web Mercator helpers", () => {
  it("puts lat 0, lon 0 at the centre of the world", () => {
    expect(latLonToGlobalPixel(0, 0, 0)).toEqual({ x: 128, y: 128 });
  });

  it("round-trips coordinates", () => {
    const { x, y } = latLonToGlobalPixel(18.5204, 73.8567, 19);
    const back = globalPixelToLatLon(x, y, 19);
    expect(back.lat).toBeCloseTo(18.5204, 6);
    expect(back.lon).toBeCloseTo(73.8567, 6);
  });

  it("matches the tile Esri serves for Pune at zoom 19", () => {
    const { x, y } = latLonToGlobalPixel(18.5204, 73.8567, 19);
    expect(Math.floor(x / TILE_SIZE)).toBe(369705);
    expect(Math.floor(y / TILE_SIZE)).toBe(234689);
  });

  it("gives about 0.28 m per pixel for Pune at zoom 19", () => {
    expect(metersPerPixel(18.5204, 19)).toBeCloseTo(0.2832, 3);
    expect(metersPerPixel(18.5204, 18)).toBeCloseTo(2 * metersPerPixel(18.5204, 19), 9);
  });
});

describe("tileWindow", () => {
  it("covers a window centred on the coordinate with every needed tile", () => {
    const window = tileWindow(18.5204, 73.8567, 19, 640);
    const center = latLonToGlobalPixel(18.5204, 73.8567, 19);
    expect(window.left).toBe(Math.round(center.x - 320));
    expect(window.top).toBe(Math.round(center.y - 320));
    // 640 px spans three or four tiles in each direction depending on alignment.
    const xs = new Set(window.tiles.map((t) => t.x));
    const ys = new Set(window.tiles.map((t) => t.y));
    expect(xs.size).toBeGreaterThanOrEqual(3);
    expect(ys.size).toBeGreaterThanOrEqual(3);
    // Every pixel of the window is covered.
    for (const corner of [
      { x: 0, y: 0 },
      { x: 639, y: 639 },
    ]) {
      expect(
        window.tiles.some(
          (t) =>
            corner.x >= t.offsetX && corner.x < t.offsetX + TILE_SIZE && corner.y >= t.offsetY && corner.y < t.offsetY + TILE_SIZE,
        ),
      ).toBe(true);
    }
  });
});
