import assert from "node:assert/strict";
import test from "node:test";
import { inspectRecoveryObjectives, validateRecoveryObjectives } from "../tools/recovery-objectives.mjs";

test("pilot recovery objectives are explicit but make no external readiness claim", async () => {
  const report = await inspectRecoveryObjectives();
  assert.equal(report.valid, true);
  assert.deepEqual(report.manifest.objectives, {
    backupIntervalMinutes: 60,
    rpoMinutes: 60,
    rtoMinutes: 240,
    immutableRetentionDays: 30,
    restoreDrillIntervalDays: 30
  });
  assert.equal(Object.values(report.manifest.activationGates).every((value) => value === false), true);
  assert.equal(Object.values(report.manifest.claims).every((value) => value === false), true);
});

test("recovery gate fails closed on optimistic claims and unsafe objectives", async () => {
  const { manifest } = await inspectRecoveryObjectives();
  const ready = structuredClone(manifest);
  ready.claims.productionReady = true;
  assert.equal(validateRecoveryObjectives(ready).valid, false);
  const weak = structuredClone(manifest);
  weak.objectives.backupIntervalMinutes = 120;
  assert.match(validateRecoveryObjectives(weak).errors.join(" "), /cannot exceed RPO/);
  const unknown = structuredClone(manifest);
  unknown.credentials = "must-not-exist";
  assert.deepEqual(validateRecoveryObjectives(unknown).errors, ["manifest shape is invalid"]);
});
