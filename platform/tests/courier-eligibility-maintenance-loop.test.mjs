import assert from "node:assert/strict";
import test from "node:test";
import { createCourierEligibilityMaintenanceLoop } from "../apps/api/courier-eligibility-maintenance-loop.js";
import { loadConfig } from "../apps/api/config.js";

test("maintenance loop schedules and processes with server time", async () => {
  const calls = [];
  const loop = createCourierEligibilityMaintenanceLoop({
    repository: {
      async scheduleMaintenanceTasks(input) { calls.push(["schedule", input]); return { renewalNotice: 1 }; },
    },
    worker: { async run() { calls.push(["worker"]); return { completed: 1 }; } },
    clock: () => Date.parse("2030-01-01T12:00:00Z"),
  });
  assert.deepEqual(await loop.runOnce(), {
    skipped: false, scheduled: { renewalNotice: 1 }, processed: { completed: 1 },
  });
  assert.deepEqual(calls, [
    ["schedule", { actorId: null, now: "2030-01-01T12:00:00.000Z" }], ["worker"],
  ]);
});

test("maintenance loop never overlaps two executions", async () => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const loop = createCourierEligibilityMaintenanceLoop({
    repository: { async scheduleMaintenanceTasks() { await blocked; return {}; } },
    worker: { async run() { return {}; } },
  });
  const first = loop.runOnce();
  assert.deepEqual(await loop.runOnce(), { skipped: true, reason: "already_running" });
  release();
  assert.equal((await first).skipped, false);
});

test("maintenance interval defaults to five minutes and is clamped to at least one minute", () => {
  assert.equal(loadConfig({ NODE_ENV: "test" }).courierEligibilityMaintenanceSeconds, 300);
  assert.equal(loadConfig({ NODE_ENV: "test", COURIER_ELIGIBILITY_MAINTENANCE_SECONDS: "1" })
    .courierEligibilityMaintenanceSeconds, 60);
  assert.equal(loadConfig({ NODE_ENV: "test", COURIER_ELIGIBILITY_MAINTENANCE_SECONDS: "600" })
    .courierEligibilityMaintenanceSeconds, 600);
});
