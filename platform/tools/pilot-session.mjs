import { readFile } from "node:fs/promises";
import { isMainModule } from "../packages/contracts/main-module.js";

const ID = /^[a-z][a-z0-9-]*$/;

export function validatePilotSession(session, evidenceRegister) {
  const errors = [];
  if (!session || typeof session !== "object" || Array.isArray(session)) {
    return Object.freeze({ valid: false, errors: Object.freeze(["session must be an object"]) });
  }
  if (!evidenceRegister || !Array.isArray(evidenceRegister.evidence)) {
    return Object.freeze({ valid: false, errors: Object.freeze(["evidence register must contain evidence"]) });
  }

  if (session.schemaVersion !== 1) errors.push("schemaVersion must equal 1");
  if (!ID.test(session.runId ?? "")) errors.push("runId is invalid");
  if (session.runId !== evidenceRegister.runId) errors.push("runId does not match the evidence register");

  const policy = session.policy ?? {};
  if (policy.syntheticDataOnly !== true) errors.push("policy.syntheticDataOnly must be true");
  for (const key of ["externalIntegrationsAllowed", "realTransactionsAllowed", "publicAccessAllowed"]) {
    if (policy[key] !== false) errors.push("policy." + key + " must be false");
  }

  const required = new Map(evidenceRegister.evidence.map((item) => [item.id, item.gateId]));
  const covered = new Map();
  const scenarioIds = new Set();

  if (!Array.isArray(session.scenarios) || session.scenarios.length === 0) {
    errors.push("scenarios must be a non-empty array");
  } else {
    for (const [index, scenario] of session.scenarios.entries()) {
      const at = "scenarios[" + index + "]";
      if (!ID.test(scenario?.id ?? "")) errors.push(at + ".id is invalid");
      else if (scenarioIds.has(scenario.id)) errors.push(at + ".id is duplicated");
      else scenarioIds.add(scenario.id);

      if (!ID.test(scenario?.gateId ?? "")) errors.push(at + ".gateId is invalid");
      if (!ID.test(scenario?.actor ?? "")) errors.push(at + ".actor is invalid");
      if (typeof scenario?.instruction !== "string" || scenario.instruction.trim().length < 20) {
        errors.push(at + ".instruction is incomplete");
      }
      if (!Array.isArray(scenario?.evidenceIds) || scenario.evidenceIds.length === 0) {
        errors.push(at + ".evidenceIds must be a non-empty array");
        continue;
      }

      const local = new Set();
      for (const evidenceId of scenario.evidenceIds) {
        if (!ID.test(evidenceId ?? "")) {
          errors.push(at + ".evidenceIds contains an invalid id");
          continue;
        }
        if (local.has(evidenceId) || covered.has(evidenceId)) {
          errors.push("duplicated evidence coverage: " + evidenceId);
        }
        local.add(evidenceId);
        const expectedGate = required.get(evidenceId);
        if (!expectedGate) errors.push("unknown evidence coverage: " + evidenceId);
        else if (scenario.gateId !== expectedGate) errors.push("incorrect gate coverage for evidence: " + evidenceId);
        if (!covered.has(evidenceId)) covered.set(evidenceId, scenario.id);
      }
    }
  }

  for (const evidenceId of required.keys()) {
    if (!covered.has(evidenceId)) errors.push("missing evidence coverage: " + evidenceId);
  }
  if (covered.size !== required.size) errors.push("evidence coverage is partial");

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export async function inspectPilotSession(
  sessionPath = new URL("../config/pilot-session.v1.json", import.meta.url),
  evidencePath = new URL("../config/pilot-evidence.v1.json", import.meta.url),
) {
  const [session, evidenceRegister] = await Promise.all([
    readFile(sessionPath, "utf8").then(JSON.parse),
    readFile(evidencePath, "utf8").then(JSON.parse),
  ]);
  return { session, evidenceRegister, ...validatePilotSession(session, evidenceRegister) };
}

if (isMainModule(import.meta.url)) {
  try {
    const report = await inspectPilotSession(process.argv[2], process.argv[3]);
    const coveredEvidence = report.session.scenarios.flatMap((scenario) => scenario.evidenceIds);
    console.log(JSON.stringify({
      valid: report.valid,
      errors: report.errors,
      runId: report.session.runId,
      scenarios: report.session.scenarios.length,
      coveredEvidence: coveredEvidence.length,
      steps: report.session.scenarios.map((scenario, index) => ({
        order: index + 1,
        id: scenario.id,
        actor: scenario.actor,
        evidenceIds: scenario.evidenceIds,
        instruction: scenario.instruction,
      })),
    }, null, 2));
    if (!report.valid) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}

