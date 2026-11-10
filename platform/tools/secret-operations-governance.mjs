import { readFile } from "node:fs/promises";
import { supportedRuntimeSecretKeys } from "../apps/api/secrets.js";
import { isMainModule } from "../packages/contracts/main-module.js";

const same = (left, right) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());

export function validateSecretOperations(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, errors: ["manifest must be an object"] };
  if (!same(Object.keys(value), ["schemaVersion", "status", "policy", "coveredKeys", "activationGates"])) errors.push("manifest shape is invalid");
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1");
  if (value.status !== "preactivation-target") errors.push("status must remain preactivation-target");
  const expected = supportedRuntimeSecretKeys();
  if (!Array.isArray(value.coveredKeys) || new Set(value.coveredKeys).size !== value.coveredKeys.length || !same(value.coveredKeys, expected)) errors.push("coveredKeys must match every supported runtime secret exactly once");
  const p = value.policy ?? {};
  const exactPolicy = ["defaultMaxAgeDays", "databaseMaxAgeDays", "emergencyRevocationMinutes", "rotationOverlapMinutes", "proposalLevel", "authorizationLevel", "finalApprovalLevel"];
  if (!same(Object.keys(p), exactPolicy)) errors.push("policy shape is invalid");
  if (!Number.isInteger(p.defaultMaxAgeDays) || p.defaultMaxAgeDays < 1 || p.defaultMaxAgeDays > 90) errors.push("default secret age cannot exceed 90 days");
  if (!Number.isInteger(p.databaseMaxAgeDays) || p.databaseMaxAgeDays < 1 || p.databaseMaxAgeDays > 180) errors.push("database secret age cannot exceed 180 days");
  if (!Number.isInteger(p.emergencyRevocationMinutes) || p.emergencyRevocationMinutes < 1 || p.emergencyRevocationMinutes > 60) errors.push("emergency revocation target cannot exceed 60 minutes");
  if (!Number.isInteger(p.rotationOverlapMinutes) || p.rotationOverlapMinutes < 5 || p.rotationOverlapMinutes > 1440) errors.push("rotation overlap must be between 5 minutes and 24 hours");
  if (p.proposalLevel !== 3 || p.authorizationLevel !== 4 || p.finalApprovalLevel !== 5) errors.push("secret operation approvals must follow levels 3, 4 and 5");
  const gateNames = ["vaultProvisioned", "serviceIdentitiesProvisioned", "auditLogVerified", "rotationPerformed", "emergencyRevocationDrilled"];
  if (!same(Object.keys(value.activationGates ?? {}), gateNames) || gateNames.some((key) => value.activationGates[key] !== false)) errors.push("external secret activation gates must remain false");
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export async function inspectSecretOperations(path = new URL("../config/secret-operations.v1.json", import.meta.url)) {
  const manifest = JSON.parse(await readFile(path, "utf8"));
  return { manifest, ...validateSecretOperations(manifest) };
}

if (isMainModule(import.meta.url)) {
  try {
    const report = await inspectSecretOperations(process.argv[2]);
    console.log(JSON.stringify({ valid: report.valid, errors: report.errors, coveredKeys: report.manifest.coveredKeys.length, secretValuesInspected: false }, null, 2));
    if (!report.valid) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}
