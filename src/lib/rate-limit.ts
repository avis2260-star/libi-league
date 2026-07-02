/**
 * Minimal in-memory sliding-window rate limiter for public endpoints.
 *
 * State lives in the serverless instance's memory — there is no shared
 * store, so a distributed attacker can exceed the nominal limit by hitting
 * many instances. That's acceptable here: the goal is stopping the cheap
 * case (one script hammering one URL and burning Gemini/Resend quota).
 * Swap for a shared store (Upstash / Vercel KV) if stronger guarantees are
 * ever needed.
 */

const buckets = new Map<string, number[]>();
const MAX_KEYS = 5_000;

/**
 * Returns true when the call is allowed, false when `key` has already made
 * `limit` allowed calls within the past `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Bound memory: when the map grows past MAX_KEYS, drop entries whose every
  // hit is already outside the window (they can't affect any decision).
  if (buckets.size >= MAX_KEYS && !buckets.has(key)) {
    for (const [k, hits] of buckets) {
      if (hits.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

/** Test helper — clears all rate-limit state. */
export function resetRateLimiter(): void {
  buckets.clear();
}
