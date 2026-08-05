import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRealtimeService } from "../apps/api/realtime-service.js";
import { createRealtimeRepository } from "../database/realtime-repository.js";

test("realtime migration persists audit events and publishes a database notification", async () => {
  const sql = await readFile(new URL("../database/migrations/013_realtime_events.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE realtime_events/);
  assert.match(sql, /AFTER INSERT ON audit_events/);
  assert.match(sql, /pg_notify\('fraldacycle_realtime'/);
  assert.match(sql, /bigserial PRIMARY KEY/);
});

test("realtime repository resumes strictly after the received cursor", async () => {
  const calls = [];
  const repository = createRealtimeRepository({
    async query(sql, values) { calls.push({ sql, values }); return { rows: [{ id: 43 }] }; },
  });
  assert.deepEqual(await repository.listAfter({ afterId: 42, limit: 500 }), [{ id: 43 }]);
  assert.match(calls[0].sql, /id > \$1/);
  assert.deepEqual(calls[0].values, [42, 100]);
});

test("SSE stream emits cursor, normalized event and safe operational headers", async () => {
  const response = new EventEmitter();
  const writes = [];
  response.writeHead = (status, headers) => { response.status = status; response.headers = headers; };
  response.write = (chunk) => { writes.push(chunk); return true; };
  const repository = {
    async listAfter() {
      return [{ id: 7, event_type: "payment.paid", source: "app", entity_type: "transaction", entity_id: "tx-1", payload: { status: "paid" }, occurred_at: "2026-08-05T00:00:00.000Z" }];
    },
  };
  const close = createRealtimeService(repository, { pollIntervalMs: 60_000, heartbeatIntervalMs: 60_000 })
    .open(response, { afterId: 6, headers: { "x-request-id": "request-1" } });
  await new Promise((resolve) => setImmediate(resolve));
  close();
  const output = writes.join("");
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "text/event-stream; charset=utf-8");
  assert.equal(response.headers["x-accel-buffering"], "no");
  assert.match(output, /retry: 3000/);
  assert.match(output, /id: 7/);
  assert.match(output, /event: realtime/);
  assert.match(output, /"type":"payment.paid"/);
});
