import { describe, expect, it } from "vitest";
import { toBase64 } from "./record";

describe("toBase64", () => {
  it("encodes recordings larger than one chunk", () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 31) % 256);
    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
});
