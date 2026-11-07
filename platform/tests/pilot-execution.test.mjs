import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectPilotExecutionRecord,
  validatePilotExecutionRecord,
} from "../tools/pilot-execution.mjs";

import { PILOT_GATES } from "../tools/pilot-contract.mjs";

const safePolicy = {
  syntheticDataOnly: true,
  externalIntegrationsAllowed: false,
  realTransactionsAllowed: false,
  publicAccessAllowed: false,
};

test("versioned pilot execution preserves its safety policy and documented decision", async () => {
  const report = await inspectPilotExecutionRecord();
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.equal(["pending", "completed"].includes(report.record.status), true);
  assert.equal(["pending", "go", "no-go"].includes(report.record.decision.outcome), true);
  assert.deepEqual(report.record.policy, safePolicy);
  if (report.record.decision.outcome === "no-go") {
    assert.equal(report.record.findings.some(item => item.status === "open"), true);
    assert.equal(report.record.nextActions.length > 0, true);
  }
});

test("pilot execution rejects unsafe policy", () => {
  const report = validatePilotExecutionRecord({
    schemaVersion: 1,
    runId: "internal-dry-run-001",
    status: "pending",
    policy: { ...safePolicy, externalIntegrationsAllowed: true },
    gateResults: [],
    findings: [],
    decision: { outcome: "pending" },
    nextActions: [],
  });
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /externalIntegrationsAllowed/);
});

test("pilot execution rejects go decision with missing evidence", () => {
  const report = validatePilotExecutionRecord({
    schemaVersion: 1,
    runId: "internal-dry-run-001",
    status: "completed",
    policy: safePolicy,
    gateResults: [{ id: "product-rules", result: "failed" }],
    findings: [{ id: "finding-1", status: "open" }],
    decision: {
      outcome: "go",
      decidedBy: "management",
      decidedAt: "2026-08-08T23:30:00.000Z",
      rationale: "Evidências insuficientes para esta decisão.",
    },
    nextActions: [],
  });
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /all gates to pass/);
  assert.match(report.errors.join("\n"), /all findings to be resolved/);
  assert.match(report.errors.join("\n"), /nextActions/);
});

test("pilot execution accepts evidenced go decision", () => {
  const report = validatePilotExecutionRecord({
    schemaVersion: 1,
    runId: "internal-dry-run-001",
    status: "completed",
    policy: safePolicy,
    gateResults: PILOT_GATES.map(id => ({ id, result: "passed" })),
    findings: [{ id: "finding-1", status: "resolved" }],
    decision: {
      outcome: "go",
      decidedBy: "management",
      decidedAt: "2026-08-08T23:30:00.000Z",
      rationale: "Todos os portões internos foram aprovados.",
    },
    nextActions: [{ id: "prepare-homologation", owner: "quality" }],
  });
  assert.equal(report.valid, true, report.errors.join("\n"));
});



test("pilot decision rejects incomplete, duplicate and unknown official gates even when marked passed", () => {
  const gateResults = PILOT_GATES.map(id => ({ id, result: "passed" }));
  const base = {
    schemaVersion: 1, runId: "internal-dry-run-002", status: "completed", policy: safePolicy,
    findings: [], nextActions: [{ id: "review-human-gates", owner: "management" }],
    decision: { outcome: "go", decidedBy: "management", decidedAt: "2026-11-07T12:00:00Z",
      rationale: "Todos os portões do ensaio interno foram conferidos." },
  };
  for (const damaged of [
    gateResults.slice(0, 1),
    gateResults.slice(1),
    [...gateResults, gateResults[0]],
    gateResults.map((g, i) => i === 0 ? { id: "imaginary-gate", result: "passed" } : g),
    gateResults.map((g, i) => i === 2 ? { ...g, result: "skipped" } : g),
    gateResults.map((g, i) => i === 2 ? null : g),
  ]) {
    const report = validatePilotExecutionRecord({ ...base, gateResults: damaged });
    assert.equal(report.valid, false, JSON.stringify(damaged));
    assert.match(report.errors.join(" | "), /all seven official gates to pass/);
  }
});

test("pilot decision fails closed on missing arrays instead of crashing or approving", () => {
  const value = {
    schemaVersion: 1, runId: "internal-dry-run-003", status: "completed", policy: safePolicy,
    gateResults: null, findings: null, nextActions: null,
    decision: { outcome: "go", decidedBy: "management", decidedAt: "2026-11-07T12:00:00Z",
      rationale: "Tentativa sintética sem os registros obrigatórios." },
  };
  const report = validatePilotExecutionRecord(value);
  assert.equal(report.valid, false);
  assert.match(report.errors.join(" | "), /gateResults must be an array/);
  assert.match(report.errors.join(" | "), /all seven official gates to pass/);
  assert.match(report.errors.join(" | "), /all findings to be resolved/);
  assert.match(report.errors.join(" | "), /nextActions/);
});
