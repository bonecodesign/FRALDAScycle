import assert from "node:assert/strict";
import test from "node:test";
import { inspectPilotSession, validatePilotSession } from "../tools/pilot-session.mjs";

const evidenceRegister = {
  runId: "internal-dry-run-001",
  evidence: [
    { id: "approved-rules", gateId: "product-rules" },
    { id: "catalog-scope", gateId: "product-rules" },
    { id: "admin-auth", gateId: "identity-access" },
  ],
};

const policy = {
  syntheticDataOnly: true,
  externalIntegrationsAllowed: false,
  realTransactionsAllowed: false,
  publicAccessAllowed: false,
};

function scenario(id, gateId, evidenceIds) {
  return { id, gateId, evidenceIds, actor: "quality", instruction: "Executar este cenário somente com dados sintéticos locais." };
}

function safeSession() {
  return {
    schemaVersion: 1,
    runId: "internal-dry-run-001",
    policy,
    scenarios: [
      scenario("confirm-approved-rules", "product-rules", ["approved-rules"]),
      scenario("confirm-catalog-scope", "product-rules", ["catalog-scope"]),
      scenario("exercise-admin-auth", "identity-access", ["admin-auth"]),
    ],
  };
}

test("executable internal session covers all 21 synthetic evidence items", async () => {
  const report = await inspectPilotSession();
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.equal(report.session.scenarios.length, 21);
  assert.equal(report.session.scenarios.flatMap((item) => item.evidenceIds).length, 21);
  assert.equal(report.evidenceRegister.evidence.length, 21);
});

test("session rejects absent scenario coverage", () => {
  const session = safeSession();
  session.scenarios = [];
  const report = validatePilotSession(session, evidenceRegister);
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /scenarios must be a non-empty array/);
  assert.match(report.errors.join("\n"), /missing evidence coverage: approved-rules/);
});

test("session rejects partial evidence coverage", () => {
  const session = safeSession();
  session.scenarios.pop();
  const report = validatePilotSession(session, evidenceRegister);
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /missing evidence coverage: admin-auth/);
  assert.match(report.errors.join("\n"), /evidence coverage is partial/);
});

test("session rejects evidence linked to an incorrect gate", () => {
  const session = safeSession();
  session.scenarios[2].gateId = "product-rules";
  const report = validatePilotSession(session, evidenceRegister);
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /incorrect gate coverage for evidence: admin-auth/);
});

test("session rejects duplicated evidence coverage", () => {
  const session = safeSession();
  session.scenarios[1].evidenceIds = ["approved-rules", "catalog-scope"];
  const report = validatePilotSession(session, evidenceRegister);
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /duplicated evidence coverage: approved-rules/);
});

test("session rejects unsafe execution policy", () => {
  const session = safeSession();
  session.policy = { ...policy, externalIntegrationsAllowed: true };
  const report = validatePilotSession(session, evidenceRegister);
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /externalIntegrationsAllowed/);
});

