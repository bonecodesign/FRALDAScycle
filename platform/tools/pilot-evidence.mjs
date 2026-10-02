import { PILOT_ID as ID, isDateString } from "./pilot-contract.mjs";
import { readFile } from "node:fs/promises";
import { isMainModule } from "../packages/contracts/main-module.js";

const STATUSES = new Set(["pending", "passed", "failed", "skipped"]);

export function validatePilotEvidenceRegister(register, manifest) {
  const errors = [];
  if (!register || typeof register !== "object" || Array.isArray(register)) {
    return Object.freeze({ valid: false, errors: Object.freeze(["register must be an object"]) });
  }
  if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.gates)) {
    return Object.freeze({ valid: false, errors: Object.freeze(["manifest must contain gates"]) });
  }

  if (register.schemaVersion !== 1) errors.push("schemaVersion must equal 1");
  if (!ID.test(register.runId ?? "")) errors.push("runId is invalid");

  const policy = register.policy ?? {};
  if (policy.syntheticDataOnly !== true) errors.push("policy.syntheticDataOnly must be true");
  for (const key of ["externalIntegrationsAllowed", "realTransactionsAllowed", "publicAccessAllowed"]) {
    if (policy[key] !== false) errors.push("policy." + key + " must be false");
  }

  const required = new Map();
  for (const gate of manifest.gates) {
    for (const evidenceId of gate.evidence ?? []) required.set(evidenceId, gate.id);
  }

  if (!Array.isArray(register.evidence)) {
    errors.push("evidence must be an array");
  } else {
    const seen = new Set();
    for (const [index, evidence] of register.evidence.entries()) {
      const at = "evidence[" + index + "]";
      if (!ID.test(evidence?.id ?? "")) errors.push(at + ".id is invalid");
      else if (seen.has(evidence.id)) errors.push(at + ".id is duplicated");
      else seen.add(evidence.id);

      const expectedGate = required.get(evidence?.id);
      if (!expectedGate) errors.push(at + ".id is not declared by the pilot manifest");
      else if (evidence.gateId !== expectedGate) errors.push(at + ".gateId does not match the pilot manifest");

      if (!STATUSES.has(evidence?.status)) errors.push(at + ".status is invalid");
      if (evidence?.source !== "synthetic") errors.push(at + ".source must equal synthetic");

      if (evidence?.status === "pending") {
        if (evidence.checkedAt !== null) errors.push(at + ".checkedAt must be null while pending");
        if (evidence.notes !== null) errors.push(at + ".notes must be null while pending");
      } else {
        if (!isDateString(evidence?.checkedAt)) errors.push(at + ".checkedAt is invalid");
        if (typeof evidence?.notes !== "string" || evidence.notes.trim().length < 10) {
          errors.push(at + ".notes are required when evidence is executed");
        }
      }
    }

    for (const evidenceId of required.keys()) {
      if (!seen.has(evidenceId)) errors.push("missing required evidence: " + evidenceId);
    }
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export async function inspectPilotEvidenceRegister(
  registerPath = new URL("../config/pilot-evidence.v1.json", import.meta.url),
  manifestPath = new URL("../config/pilot-readiness.v1.json", import.meta.url),
) {
  const [register, manifest] = await Promise.all([
    readFile(registerPath, "utf8").then(JSON.parse),
    readFile(manifestPath, "utf8").then(JSON.parse),
  ]);
  return { register, manifest, ...validatePilotEvidenceRegister(register, manifest) };
}

if (isMainModule(import.meta.url)) {
  try {
    const report = await inspectPilotEvidenceRegister(process.argv[2], process.argv[3]);
    const counts = Object.fromEntries([...STATUSES].map((status) => [
      status,
      report.register.evidence.filter((item) => item.status === status).length,
    ]));
    console.log(JSON.stringify({ valid: report.valid, errors: report.errors, counts }, null, 2));
    if (!report.valid) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}

