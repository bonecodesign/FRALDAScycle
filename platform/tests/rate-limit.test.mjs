import assert from "node:assert/strict";
import test from "node:test";
import {
  createConfiguredRateLimiter, createDistributedRateLimiter, createRateLimiter,
} from "../apps/api/rate-limit.js";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";

test("rate limiter blocks excess requests and resets its fixed window", () => {
  let clock = 1_000;
  const limiter = createRateLimiter({ limit: 2, windowMs: 1_000, now: () => clock });
  assert.equal(limiter.consume("client").allowed, true);
  assert.equal(limiter.consume("client").allowed, true);
  assert.equal(limiter.consume("client").allowed, false);
  clock = 2_001;
  assert.equal(limiter.consume("client").allowed, true);
});

test("HTTP API limits ordinary routes but keeps health probes available", async (context) => {
  const config = loadConfig({ NODE_ENV: "test", RATE_LIMIT_MAX: "2", RATE_LIMIT_WINDOW_SECONDS: "60" });
  const server = createApiServer({ config });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  assert.equal((await fetch(`${origin}/missing`)).status, 404);
  assert.equal((await fetch(`${origin}/missing`)).status, 404);
  const limited = await fetch(`${origin}/missing`);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("ratelimit-remaining"), "0");
  assert.ok(Number(limited.headers.get("retry-after")) >= 1);
  assert.equal((await fetch(`${origin}/health`)).status, 200);
});


test("distributed limiter uses an authenticated provider-neutral HTTPS contract", async () => {
  const calls = [];
  const limiter = createDistributedRateLimiter({
    endpoint: "https://rate-limit.example.test/consume",
    secret: "provider-secret",
    limit: 10,
    windowMs: 60_000,
    async fetchImpl(url, options) {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({
        allowed: true, remaining: 9, resetAt: 61_000, retryAfterSeconds: 60,
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const result = await limiter.consume("client-123");
  assert.equal(limiter.mode, "distributed");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 9);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers.authorization, "Bearer provider-secret");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    key: "client-123", limit: 10, windowMs: 60_000,
  });
});

test("configured limiter fails closed when the distributed provider is unavailable", async () => {
  const limiter = createConfiguredRateLimiter(loadConfig({
    NODE_ENV: "test",
    RATE_LIMIT_PROVIDER_URL: "https://rate-limit.example.test/consume",
    RATE_LIMIT_PROVIDER_SECRET: "provider-secret",
  }), {
    async fetchImpl() { throw new Error("network unavailable"); },
  });
  await assert.rejects(limiter.consume("client"), (error) => (
    error.code === "rate_limit_unavailable" && error.status === 503
  ));

  assert.throws(() => loadConfig({
    RATE_LIMIT_PROVIDER_URL: "https://rate-limit.example.test/consume",
  }), /configured together/);
  assert.throws(() => loadConfig({
    RATE_LIMIT_PROVIDER_URL: "http://rate-limit.example.test/consume",
    RATE_LIMIT_PROVIDER_SECRET: "provider-secret",
  }), /must use HTTPS/);
});

test("HTTP API returns a safe 503 when its configured limiter is unavailable", async (context) => {
  const server = createApiServer({
    config: loadConfig({ NODE_ENV: "test" }),
    rateLimiter: {
      async consume() {
        const error = new Error("provider details must stay private");
        error.code = "rate_limit_unavailable";
        error.status = 503;
        throw error;
      },
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/missing`);
  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.error.code, "rate_limit_unavailable");
  assert.equal(payload.error.message, "Não foi possível concluir a solicitação.");
});
