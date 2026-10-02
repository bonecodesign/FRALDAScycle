import { PILOT_ID as ID, isDateString } from "./pilot-contract.mjs";
import { readFile } from "node:fs/promises";
import { isMainModule } from "../packages/contracts/main-module.js";

const OUTCOMES = new Set(["pending", "go", "no-go"]);
const STATUSES = new Set(["pending", "completed"]);

export function validatePilotExecutionRecord(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({ valid: false, errors: Object.freeze(["record must be an object"]) });
  }

  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1");
  if (!ID.test(value.runId ?? "")) errors.push("runId is invalid");
  if (!STATUSES.has(value.status)) errors.push("status is invalid");

  const policy = value.policy ?? {};
  if (policy.syntheticDataOnly !== true) errors.push("policy.syntheticDataOnly must be true");
  for (const key of ["externalIntegrationsAllowed", "realTransactionsAllowed", "publicAccessAllowed"]) {
    if (policy[key] !== false) errors.push("policy." + key + " must be false");
  }

  if (!Array.isArray(value.gateResults)) errors.push("gateResults must be an array");
  if (!Array.isArray(value.findings)) errors.push("findings must be an array");
  if (!Array.isArray(value.nextActions)) errors.push("nextActions must be an array");

  const decision = value.decision ?? {};
  if (!OUTCOMES.has(decision.outcome)) errors.push("decision.outcome is invalid");

  if (value.status === "pending" && decision.outcome !== "pending") {
    errors.push("pending record must have a pending decision");
  }

  if (decision.outcome !== "pending") {
    if (value.status !== "completed") errors.push("decided record must be completed");
    if (!ID.test(decision.decidedBy ?? "")) errors.push("decision.decidedBy is invalid");
    if (!isDateString(decision.decidedAt)) errors.push("decision.decidedAt is invalid");
    if (typeof decision.rationale !== "string" || decision.rationale.trim().length < 10) {
      errors.push("decision.rationale is required");
    }
  }

  if (decision.outcome === "go") {
    if (value.gateResults.length === 0 || value.gateResults.some((gate) => gate?.result !== "passed")) {
      errors.push("go decision requires all gates to pass");
    }
    if (value.findings.some((finding) => finding?.status !== "resolved")) {
      errors.push("go decision requires all findings to be resolved");
    }
    if (value.nextActions.length === 0) errors.push("go decision requires nextActions");
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export async function inspectPilotExecutionRecord(
  path = new URL("../config/pilot-execution.v1.json", import.meta.url),
) {
  const record = JSON.parse(await readFile(path, "utf8"));
  return { record, ...validatePilotExecutionRecord(record) };
}

if (isMainModule(import.meta.url)) {
  try {
    const report = await inspectPilotExecutionRecord(process.argv[2]);
    console.log(JSON.stringify({ valid: report.valid, errors: report.errors }, null, 2));
    if (!report.valid) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}

