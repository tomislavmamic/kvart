/**
 * Minimal in-memory rate limiter keyed by IP. Good enough for a
 * neighborhood site on Fluid Compute where instances are reused;
 * worst case (fresh instance) it simply resets the window.
 */
const hits = new Map<string, { count: number; windowStart: number }>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 5;

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MAX_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}
