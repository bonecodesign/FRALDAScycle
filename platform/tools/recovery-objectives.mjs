import { readFile } from "node:fs/promises";
import { isMainModule } from "../packages/contracts/main-module.js";

const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");

export function validateRecoveryObjectives(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "status", "scope", "objectives", "activationGates", "claims"])) {
    return { valid: false, errors: ["manifest shape is invalid"] };
  }
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1");
  if (value.status !== "preactivation-target") errors.push("status must remain preactivation-target");
  if (value.scope !== "pilot-bh") errors.push("scope must equal pilot-bh");
  const objectiveKeys = ["backupIntervalMinutes", "rpoMinutes", "rtoMinutes", "immutableRetentionDays", "restoreDrillIntervalDays"];
  if (!exactKeys(value.objectives, objectiveKeys)) errors.push("objectives shape is invalid");
  else {
    const o = value.objectives;
    for (const key of objectiveKeys) if (!Number.isInteger(o[key]) || o[key] < 1) errors.push(`objectives.${key} must be a positive integer`);
    if (o.backupIntervalMinutes > o.rpoMinutes) errors.push("backup interval cannot exceed RPO");
    if (o.rpoMinutes > 1440) errors.push("RPO cannot exceed 24 hours");
    if (o.rtoMinutes > 1440) errors.push("RTO cannot exceed 24 hours");
    if (o.immutableRetentionDays < 30 || o.immutableRetentionDays > 365) errors.push("immutable retention must be between 30 and 365 days");
    if (o.restoreDrillIntervalDays > 90) errors.push("restore drill interval cannot exceed 90 days");
  }
  const gates = ["externalStorageProvisioned", "kmsProvisioned", "vaultProvisioned", "operatorAccessApproved", "scheduledBackupVerified", "externalRestoreVerified", "alertsVerified"];
  if (!exactKeys(value.activationGates, gates) || gates.some((key) => value.activationGates[key] !== false)) errors.push("all external activation gates must remain false before provisioning");
  const claims = ["productionReady", "objectivesProven", "externalRecoveryPerformed"];
  if (!exactKeys(value.claims, claims) || claims.some((key) => value.claims[key] !== false)) errors.push("preactivation manifest cannot claim external readiness");
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export async function inspectRecoveryObjectives(path = new URL("../config/recovery-objectives.v1.json", import.meta.url)) {
  const manifest = JSON.parse(await readFile(path, "utf8"));
  return { manifest, ...validateRecoveryObjectives(manifest) };
}

if (isMainModule(import.meta.url)) {
  try {
    const report = await inspectRecoveryObjectives(process.argv[2]);
    console.log(JSON.stringify({ valid: report.valid, errors: report.errors, objectives: report.manifest.objectives }, null, 2));
    if (!report.valid) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}
