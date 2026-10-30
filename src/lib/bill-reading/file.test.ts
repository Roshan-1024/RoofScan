import { describe, expect, it } from "vitest";
import { fitLongEdge } from "./file";

describe("fitLongEdge", () => {
  it("shrinks a phone photo so its long edge fits", () => {
    expect(fitLongEdge(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitLongEdge(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });

  it("never enlarges a small image", () => {
    expect(fitLongEdge(800, 600, 2000)).toEqual({ width: 800, height: 600 });
  });
});
