import assert from "node:assert/strict";
import test from "node:test";
import { supportedRuntimeSecretKeys } from "../apps/api/secrets.js";
import { inspectSecretOperations, validateSecretOperations } from "../tools/secret-operations-governance.mjs";

test("secret operations inventory covers every supported key without storing values", async () => {
  const report = await inspectSecretOperations();
  assert.equal(report.valid, true);
  assert.deepEqual([...report.manifest.coveredKeys].sort(), [...supportedRuntimeSecretKeys()].sort());
  assert.deepEqual(report.manifest.policy, {
    defaultMaxAgeDays: 90,
    databaseMaxAgeDays: 180,
    emergencyRevocationMinutes: 60,
    rotationOverlapMinutes: 60,
    proposalLevel: 3,
    authorizationLevel: 4,
    finalApprovalLevel: 5
  });
  assert.equal(Object.values(report.manifest.activationGates).every((value) => value === false), true);
});

test("secret operations fail closed on missing keys, weak targets and premature gates", async () => {
  const { manifest } = await inspectSecretOperations();
  const missing = structuredClone(manifest);
  missing.coveredKeys.pop();
  assert.match(validateSecretOperations(missing).errors.join(" "), /every supported runtime secret/);
  const slow = structuredClone(manifest);
  slow.policy.emergencyRevocationMinutes = 61;
  assert.match(validateSecretOperations(slow).errors.join(" "), /cannot exceed 60/);
  const active = structuredClone(manifest);
  active.activationGates.vaultProvisioned = true;
  assert.match(validateSecretOperations(active).errors.join(" "), /must remain false/);
});
