import { describe, expect, it } from "vitest";
import { fitIntoSquare, metersPerPixelFromLine, toMetres } from "./upload";

describe("fitIntoSquare", () => {
  it("centres a landscape photo with bands above and below", () => {
    expect(fitIntoSquare(4000, 3000, 800)).toEqual({ drawWidth: 800, drawHeight: 600, offsetX: 0, offsetY: 100 });
  });

  it("centres a portrait photo with bands at the sides", () => {
    expect(fitIntoSquare(1080, 1920, 800)).toEqual({ drawWidth: 450, drawHeight: 800, offsetX: 175, offsetY: 0 });
  });

  it("scales small photos up to fill the square", () => {
    expect(fitIntoSquare(400, 400, 800)).toEqual({ drawWidth: 800, drawHeight: 800, offsetX: 0, offsetY: 0 });
  });
});

describe("metersPerPixelFromLine", () => {
  it("divides the real length by the line's length in pixels", () => {
    expect(metersPerPixelFromLine({ x: 100, y: 100 }, { x: 300, y: 100 }, 10)).toBeCloseTo(0.05);
    expect(metersPerPixelFromLine({ x: 0, y: 0 }, { x: 30, y: 40 }, 5)).toBeCloseTo(0.1);
  });

  it("rejects lines too short to be precise", () => {
    expect(metersPerPixelFromLine({ x: 0, y: 0 }, { x: 10, y: 0 }, 5)).toBeNull();
  });

  it("rejects implausible lengths", () => {
    expect(metersPerPixelFromLine({ x: 0, y: 0 }, { x: 200, y: 0 }, 0.5)).toBeNull();
    expect(metersPerPixelFromLine({ x: 0, y: 0 }, { x: 200, y: 0 }, 500)).toBeNull();
    expect(metersPerPixelFromLine({ x: 0, y: 0 }, { x: 200, y: 0 }, Number.NaN)).toBeNull();
  });
});

describe("toMetres", () => {
  it("converts feet", () => {
    expect(toMetres(32.8084, "ft")).toBeCloseTo(10);
    expect(toMetres(10, "m")).toBe(10);
  });
});
