import assert from "node:assert/strict";
import test from "node:test";
import { evaluateInfrastructureAlerts } from "../packages/contracts/infrastructure-alerts.js";

const now = Date.parse("2026-10-23T20:00:00Z");
const healthy = {
  observedAt: "2026-10-23T19:59:00Z",
  metrics: {
    cpuPercent: 25, memoryPercent: 40, diskPercent: 45, apiErrorRatePercent: 0.2,
    commonLatencyMs: 120, backupAgeHours: 2, certificateDaysRemaining: 80, downtimeMinutes: 0,
  },
};

test("classifies a complete recent snapshot without authorizing launch", () => {
  const result = evaluateInfrastructureAlerts(healthy, { clock: () => now });
  assert.equal(result.status, "ok");
  assert.equal(result.launchHealthy, true);
  assert.deepEqual(result.summary, { critical: 0, warning: 0, ok: 8 });
  assert.match(result.notice, /ativação ainda depende/);
});

test("uses the approved warning and critical boundaries", () => {
  const result = evaluateInfrastructureAlerts({
    ...healthy,
    metrics: { ...healthy.metrics, cpuPercent: 70, memoryPercent: 90, certificateDaysRemaining: 7, backupAgeHours: 12 },
  }, { clock: () => now });
  assert.equal(result.status, "critical");
  assert.equal(result.launchHealthy, false);
  assert.equal(result.items.find(item => item.metric === "cpuPercent").level, "warning");
  assert.equal(result.items.find(item => item.metric === "memoryPercent").level, "critical");
  assert.equal(result.items.find(item => item.metric === "certificateDaysRemaining").level, "critical");
  assert.equal(result.items.find(item => item.metric === "backupAgeHours").level, "critical");
});

test("never presents missing, invalid, future or stale telemetry as healthy", () => {
  for (const snapshot of [
    null,
    { ...healthy, metrics: { ...healthy.metrics, diskPercent: undefined } },
    { ...healthy, metrics: { ...healthy.metrics, diskPercent: -1 } },
    { ...healthy, observedAt: "2026-10-23T19:40:00Z" },
    { ...healthy, observedAt: "2026-10-23T20:01:00Z" },
  ]) {
    const result = evaluateInfrastructureAlerts(snapshot, { clock: () => now });
    assert.equal(result.status, "unknown");
    assert.equal(result.launchHealthy, false);
  }
});
