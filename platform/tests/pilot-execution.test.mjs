import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectPilotExecutionRecord,
  validatePilotExecutionRecord,
} from "../tools/pilot-execution.mjs";

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
    gateResults: [{ id: "product-rules", result: "passed" }],
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

