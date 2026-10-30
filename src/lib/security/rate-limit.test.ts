import { describe, expect, it } from "vitest";
import { clientKey, DailyCap, RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("allows up to the limit within the window", () => {
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 10)).toBe(true);
    expect(limiter.allow("a", 20)).toBe(false);
  });

  it("allows again once old hits leave the window", () => {
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 999)).toBe(false);
    expect(limiter.allow("a", 1001)).toBe(true);
  });

  it("counts keys separately", () => {
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("b", 0)).toBe(true);
  });

  it("forgets the oldest key when full", () => {
    const limiter = new RateLimiter(1, 1000, 2);
    limiter.allow("a", 0);
    limiter.allow("b", 0);
    limiter.allow("c", 0);
    expect(limiter.allow("a", 1)).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the first forwarded address", () => {
    const request = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } });
    expect(clientKey(request)).toBe("1.2.3.4");
  });

  it("falls back when no proxy headers are present", () => {
    expect(clientKey(new Request("http://x"))).toBe("unknown");
  });
});

describe("DailyCap", () => {
  it("allows up to the cap each UTC day", () => {
    const cap = new DailyCap(2);
    const morning = Date.UTC(2026, 9, 30, 6);
    expect(cap.allow(morning)).toBe(true);
    expect(cap.allow(morning + 1000)).toBe(true);
    expect(cap.allow(morning + 2000)).toBe(false);
    // A new UTC day starts a fresh count.
    expect(cap.allow(Date.UTC(2026, 9, 31, 0, 0, 1))).toBe(true);
  });
});
