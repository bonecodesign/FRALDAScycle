import assert from "node:assert/strict";
import test from "node:test";
import { runSyntheticLoadProbe } from "../tools/synthetic-load-probe.mjs";

test("executes planned stages, controlled peak, integrity and recovery probes", async () => {
  const calls = [];
  const result = await runSyntheticLoadProbe({
    confirmed: true,
    async operation(context) { calls.push(context); },
    async integrityProbe() { return { lostRecords: 0, corruptedRecords: 0, duplicateCommitments: 0 }; },
    async recoveryProbe() { return true; },
    peakUsers: 320,
  });
  assert.equal(calls.length, 720);
  assert.deepEqual(result.report.stages.map(item => item.concurrentUsers), [100, 300]);
  assert.equal(result.report.controlledPeak.concurrentUsers, 320);
  assert.equal(result.readiness.status, "synthetic-pass");
  assert.equal(result.readiness.launchAuthorized, false);
});

test("records operation failures instead of hiding them", async () => {
  const result = await runSyntheticLoadProbe({
    confirmed: true,
    async operation({ virtualUser }) { if (virtualUser === 1) throw new Error("synthetic failure"); },
    async integrityProbe() { return { lostRecords: 0, corruptedRecords: 0, duplicateCommitments: 0 }; },
    async recoveryProbe() { return false; },
    peakUsers: 300,
  });
  assert.equal(result.readiness.status, "blocked");
  assert.ok(result.readiness.blockers.includes("stage_100_error_rate_exceeded"));
  assert.ok(result.readiness.blockers.includes("post_peak_recovery_required"));
});

test("requires explicit confirmation, bounded peak and all probes", async () => {
  const valid = { confirmed: true, operation: async () => {}, integrityProbe: async () => ({}), recoveryProbe: async () => true };
  await assert.rejects(runSyntheticLoadProbe({ ...valid, confirmed: false }), /explicit confirmation/);
  await assert.rejects(runSyntheticLoadProbe({ ...valid, peakUsers: 1001 }), /between 300 and 1000/);
  await assert.rejects(runSyntheticLoadProbe({ ...valid, recoveryProbe: null }), /requires operation/);
});
