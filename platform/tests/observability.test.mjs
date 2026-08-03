import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../apps/api/config.js";
import { resolveRuntimeEnv } from "../apps/api/secrets.js";
import { createTelemetry } from "../apps/api/telemetry.js";
import { createApiServer } from "../apps/api/server.js";

test("external secrets resolver requests only allowlisted keys over authenticated HTTPS", async () => {
  const calls = [];
  const resolved = await resolveRuntimeEnv({
    NODE_ENV: "production",
    SECRETS_PROVIDER_URL: "https://secrets.example.test/resolve",
    SECRETS_PROVIDER_TOKEN: "vault-token",
    SECRETS_PROVIDER_KEYS: "DATABASE_URL,SESSION_SECRET",
    CORS_ORIGINS: "https://fraldacycle.example",
  }, {
    async fetchImpl(url, options) {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({
        secrets: {
          DATABASE_URL: "postgresql://database/fraldacycle",
          SESSION_SECRET: "a".repeat(48),
          UNREQUESTED_SECRET: "must-not-be-merged",
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers.authorization, "Bearer vault-token");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    keys: ["DATABASE_URL", "SESSION_SECRET"],
  });
  assert.equal(resolved.DATABASE_URL, "postgresql://database/fraldacycle");
  assert.equal(resolved.UNREQUESTED_SECRET, undefined);
  assert.equal(resolved.CORS_ORIGINS, "https://fraldacycle.example");
});

test("external secrets configuration fails closed on insecure or incomplete contracts", async () => {
  await assert.rejects(resolveRuntimeEnv({
    SECRETS_PROVIDER_URL: "http://secrets.example.test",
    SECRETS_PROVIDER_TOKEN: "token",
    SECRETS_PROVIDER_KEYS: "DATABASE_URL",
  }), /must use HTTPS/);
  await assert.rejects(resolveRuntimeEnv({
    SECRETS_PROVIDER_URL: "https://secrets.example.test",
    SECRETS_PROVIDER_TOKEN: "token",
    SECRETS_PROVIDER_KEYS: "DATABASE_URL,DATABASE_URL",
  }), /invalid or duplicate/);
  await assert.rejects(resolveRuntimeEnv({
    SECRETS_PROVIDER_URL: "https://secrets.example.test",
  }), /configured together/);
});

test("telemetry exports only safe structured fields and tolerates provider failure", async () => {
  const lines = [];
  const calls = [];
  const config = loadConfig({
    NODE_ENV: "test",
    TELEMETRY_PROVIDER_URL: "https://telemetry.example.test/events",
    TELEMETRY_PROVIDER_SECRET: "telemetry-secret",
  });
  const telemetry = createTelemetry(config, {
    write(line) { lines.push(JSON.parse(line)); },
    async fetchImpl(url, options) {
      calls.push({ url: String(url), options });
      throw new Error("provider unavailable");
    },
  });
  const delivered = await telemetry.record({
    type: "http.request", requestId: "request-1", method: "POST",
    route: "/v1/auth/login", status: 401, durationMs: 12.5,
    password: "never-export", authorization: "Bearer never-export",
  });

  assert.equal(delivered, false);
  assert.equal(telemetry.mode, "hosted");
  assert.equal(lines.length, 1);
  assert.equal(lines[0].route, "/v1/auth/login");
  assert.equal(lines[0].password, undefined);
  assert.equal(lines[0].authorization, undefined);
  const exported = JSON.parse(calls[0].options.body);
  assert.equal(exported.password, undefined);
  assert.equal(calls[0].options.headers.authorization, "Bearer telemetry-secret");
});

test("HTTP server records request metadata through an injectable telemetry adapter", async (context) => {
  const events = [];
  const server = createApiServer({
    config: loadConfig({ NODE_ENV: "test" }),
    telemetry: { async record(event) { events.push(event); return true; } },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/unknown`);
  assert.equal(response.status, 404);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "http.request");
  assert.equal(events[0].route, "/unknown");
  assert.equal(events[0].status, 404);
  assert.ok(events[0].durationMs >= 0);
});

test("hosted telemetry configuration requires paired HTTPS credentials", () => {
  assert.throws(() => loadConfig({
    TELEMETRY_PROVIDER_URL: "https://telemetry.example.test/events",
  }), /configured together/);
  assert.throws(() => loadConfig({
    TELEMETRY_PROVIDER_URL: "http://telemetry.example.test/events",
    TELEMETRY_PROVIDER_SECRET: "secret",
  }), /must use HTTPS/);
});
