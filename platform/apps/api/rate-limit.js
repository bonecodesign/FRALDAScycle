export class RateLimitDependencyError extends Error {
  constructor(message = "Serviço distribuído de limitação indisponível.") {
    super(message);
    this.code = "rate_limit_unavailable";
    this.status = 503;
  }
}

function resultFromPayload(payload, limit) {
  const resetAt = Number(payload?.resetAt);
  const remaining = Number(payload?.remaining);
  if (
    typeof payload?.allowed !== "boolean"
    || !Number.isFinite(resetAt)
    || !Number.isInteger(remaining)
    || remaining < 0
  ) throw new RateLimitDependencyError("Resposta inválida do provedor de rate limiting.");
  return {
    allowed: payload.allowed,
    limit,
    remaining: Math.min(limit, remaining),
    resetAt,
    retryAfterSeconds: Math.max(1, Number(payload.retryAfterSeconds) || Math.ceil((resetAt - Date.now()) / 1000)),
  };
}

export function createRateLimiter({ limit = 120, windowMs = 60_000, now = Date.now } = {}) {
  const buckets = new Map();

  return Object.freeze({
    mode: "memory",
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

export function createDistributedRateLimiter({
  endpoint, secret, limit = 120, windowMs = 60_000, fetchImpl = fetch,
} = {}) {
  if (!endpoint || !secret) throw new Error("Distributed rate limiting requires endpoint and secret");
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("Distributed rate limiting requires HTTPS");

  return Object.freeze({
    mode: "distributed",
    async consume(key) {
      let response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify({ key, limit, windowMs }),
          signal: AbortSignal.timeout(2_000),
        });
      } catch {
        throw new RateLimitDependencyError();
      }
      if (!response.ok) throw new RateLimitDependencyError();
      try {
        return resultFromPayload(await response.json(), limit);
      } catch (error) {
        if (error instanceof RateLimitDependencyError) throw error;
        throw new RateLimitDependencyError("Resposta inválida do provedor de rate limiting.");
      }
    },
  });
}

export function createConfiguredRateLimiter(config, options = {}) {
  if (config.rateLimitProviderUrl) {
    return createDistributedRateLimiter({
      endpoint: config.rateLimitProviderUrl,
      secret: config.rateLimitProviderSecret,
      limit: config.rateLimitMax,
      windowMs: config.rateLimitWindowSeconds * 1000,
      fetchImpl: options.fetchImpl,
    });
  }
  return createRateLimiter({
    limit: config.rateLimitMax,
    windowMs: config.rateLimitWindowSeconds * 1000,
    now: options.now,
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
