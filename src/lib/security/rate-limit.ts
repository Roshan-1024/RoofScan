/**
 * Sliding-window rate limiter kept in memory. Each server instance counts
 * on its own, which is enough to stop one visitor from hammering an
 * endpoint that costs money or calls a rate-limited service.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
  ) {}

  /** Records a hit for `key` and returns whether it is within the limit. */
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    if (!this.hits.has(key) && this.hits.size >= this.maxKeys) {
      this.hits.delete(this.hits.keys().next().value!);
    }
    this.hits.set(key, recent);
    return true;
  }
}

/**
 * Caps requests per UTC day across all visitors of one server instance, so
 * a burst of traffic can't run up an unbounded model bill.
 */
export class DailyCap {
  private day = "";
  private used = 0;

  constructor(private readonly limit: number) {}

  /** Counts a request and returns whether today's cap still allows it. */
  allow(now = Date.now()): boolean {
    const day = new Date(now).toISOString().slice(0, 10);
    if (day !== this.day) {
      this.day = day;
      this.used = 0;
    }
    if (this.used >= this.limit) return false;
    this.used++;
    return true;
  }
}

/** Best-effort client identifier from proxy headers. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}
