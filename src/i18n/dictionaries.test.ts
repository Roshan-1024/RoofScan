import { describe, expect, it } from "vitest";
import { en } from "./dictionaries/en";
import { hi } from "./dictionaries/hi";

/** Lists every leaf path in a dictionary, including array indices. */
function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leafPaths(item, `${prefix}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      leafPaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  throw new Error(`Unexpected value at ${prefix}: ${String(value)}`);
}

function leafValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(leafValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(leafValues);
  return [];
}

describe("dictionaries", () => {
  it("Hindi has exactly the same keys and list lengths as English", () => {
    expect(leafPaths(hi)).toEqual(leafPaths(en));
  });

  it("has no empty strings", () => {
    for (const dict of [en, hi]) {
      expect(leafValues(dict).filter((text) => text.trim() === "")).toEqual([]);
    }
  });

  it("Hindi body text is written in Devanagari", () => {
    const sentences = leafValues(hi).filter((text) => text.length > 40);
    for (const sentence of sentences) {
      expect(sentence).toMatch(/[ऀ-ॿ]/);
    }
  });
});
