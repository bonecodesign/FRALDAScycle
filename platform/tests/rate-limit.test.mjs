import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter } from "../apps/api/rate-limit.js";
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
