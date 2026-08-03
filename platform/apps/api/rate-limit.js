export function createRateLimiter({ limit = 120, windowMs = 60_000, now = Date.now } = {}) {
  const buckets = new Map();

  return Object.freeze({
    consume(key) {
      const timestamp = now();
      const current = buckets.get(key);
      const bucket = !current || current.resetAt <= timestamp
        ? { count: 0, resetAt: timestamp + windowMs }
        : current;
      bucket.count += 1;
      buckets.set(key, bucket);
      if (buckets.size > 10_000) {
        for (const [candidate, value] of buckets) {
          if (value.resetAt <= timestamp) buckets.delete(candidate);
        }
      }
      return {
        allowed: bucket.count <= limit,
        limit,
        remaining: Math.max(0, limit - bucket.count),
        resetAt: bucket.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - timestamp) / 1000)),
      };
    },
  });
}

export function requestClientKey(request) {
  return String(request.socket?.remoteAddress ?? "unknown").slice(0, 128);
}

export function rateLimitHeaders(result) {
  return {
    "ratelimit-limit": String(result.limit),
    "ratelimit-remaining": String(result.remaining),
    "ratelimit-reset": String(Math.ceil(result.resetAt / 1000)),
  };
}
