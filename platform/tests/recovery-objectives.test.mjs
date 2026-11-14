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

test("recovery objectives reject malformed nested sections without claiming readiness", async () => {
  const { manifest } = await inspectRecoveryObjectives();
  for (const key of ["objectives", "activationGates", "claims"]) {
    for (const invalid of [null, 0, "invalid", [], true]) {
      const candidate = structuredClone(manifest);
      candidate[key] = invalid;
      const report = validateRecoveryObjectives(candidate);
      assert.equal(report.valid, false, key + " must reject " + String(invalid));
      assert.ok(report.errors.some(error => error.includes(key === "objectives" ? "objectives shape" : key === "activationGates" ? "activation gates" : "external readiness")));
    }
  }
});

test("recovery objectives reject optimistic external gates and invalid time targets", async () => {
  const { manifest } = await inspectRecoveryObjectives();
  for (const key of Object.keys(manifest.activationGates)) {
    const candidate = structuredClone(manifest);
    candidate.activationGates[key] = true;
    assert.equal(validateRecoveryObjectives(candidate).valid, false, key);
  }
  for (const [key, value] of [["backupIntervalMinutes", 0], ["rpoMinutes", -1], ["rtoMinutes", 1441], ["immutableRetentionDays", 29], ["restoreDrillIntervalDays", 91]]) {
    const candidate = structuredClone(manifest);
    candidate.objectives[key] = value;
    assert.equal(validateRecoveryObjectives(candidate).valid, false, key);
  }
});
