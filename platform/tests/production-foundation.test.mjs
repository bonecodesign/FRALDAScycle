import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../apps/api/config.js";
import { createApiServer } from "../apps/api/server.js";
import { hashPassword, verifyPassword, createSessionToken } from "../apps/api/security.js";

test("production configuration fails closed", () => {
  assert.throws(() => loadConfig({ NODE_ENV: "production" }), /DATABASE_URL/);
  assert.throws(() => loadConfig({
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://database/fraldacycle",
    SESSION_SECRET: "short",
  }), /at least 32/);
});

test("passwords are hashed and sessions use high-entropy opaque tokens", async () => {
  const encoded = await hashPassword("uma-senha-forte-2026");
  assert.match(encoded, /^scrypt\$/);
  assert.equal(await verifyPassword("uma-senha-forte-2026", encoded), true);
  assert.equal(await verifyPassword("senha-incorreta", encoded), false);
  assert.ok(createSessionToken().length >= 43);
});

test("API exposes health, readiness and safe errors", async (context) => {
  const server = createApiServer({ config: loadConfig({ API_PORT: "4200" }) });
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  context.after(() => server.close());
  const { port } = server.address();

  const health = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");

  const missing = await fetch(`http://127.0.0.1:${port}/unknown`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "route_not_found");
});

test("initial PostgreSQL schema protects core invariants", async () => {
  const sql = await readFile(resolve(import.meta.dirname, "../database/migrations/001_initial.sql"), "utf8");
  for (const table of ["users", "sessions", "addresses", "listings", "transactions", "audit_events"]) {
    assert.match(sql, new RegExp(`CREATE TABLE ${table}`));
  }
  assert.match(sql, /token_hash bytea NOT NULL UNIQUE/);
  assert.match(sql, /transaction_parties_differ/);
  assert.match(sql, /listing_price_policy/);
});
