import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectPilotEvidenceRegister,
  validatePilotEvidenceRegister,
} from "../tools/pilot-evidence.mjs";

const manifest = {
  gates: [
    { id: "product-rules", evidence: ["approved-rules", "catalog-scope"] },
    { id: "identity-access", evidence: ["admin-auth"] },
  ],
};

const safeRegister = {
  schemaVersion: 1,
  runId: "internal-dry-run-001",
  policy: {
    syntheticDataOnly: true,
    externalIntegrationsAllowed: false,
    realTransactionsAllowed: false,
    publicAccessAllowed: false,
  },
  evidence: [
    {
      id: "approved-rules",
      gateId: "product-rules",
      status: "pending",
      source: "synthetic",
      checkedAt: null,
      notes: null,
    },
    {
      id: "catalog-scope",
      gateId: "product-rules",
      status: "pending",
      source: "synthetic",
      checkedAt: null,
      notes: null,
    },
    {
      id: "admin-auth",
      gateId: "identity-access",
      status: "pending",
      source: "synthetic",
      checkedAt: null,
      notes: null,
    },
  ],
};

test("versioned pilot evidence covers every manifest requirement safely", async () => {
  const report = await inspectPilotEvidenceRegister();
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.equal(report.register.evidence.length, 21);
  assert.equal(report.register.evidence.every((item) => ["pending", "passed", "failed", "skipped"].includes(item.status)), true);
  assert.equal(report.register.evidence.every((item) => item.source === "synthetic"), true);
});

test("pilot evidence rejects missing, duplicated and misplaced evidence", () => {
  const register = structuredClone(safeRegister);
  register.evidence = [
    register.evidence[0],
    { ...register.evidence[0] },
    { ...register.evidence[2], gateId: "product-rules" },
  ];
  const report = validatePilotEvidenceRegister(register, manifest);
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /duplicated/);
  assert.match(report.errors.join("\n"), /does not match/);
  assert.match(report.errors.join("\n"), /missing required evidence: catalog-scope/);
});

test("pilot evidence rejects unsafe sources and incomplete executed results", () => {
  const register = structuredClone(safeRegister);
  register.policy.externalIntegrationsAllowed = true;
  register.evidence[0] = {
    ...register.evidence[0],
    status: "passed",
    source: "external",
    checkedAt: null,
    notes: "curta",
  };
  const report = validatePilotEvidenceRegister(register, manifest);
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /externalIntegrationsAllowed/);
  assert.match(report.errors.join("\n"), /source must equal synthetic/);
  assert.match(report.errors.join("\n"), /checkedAt is invalid/);
  assert.match(report.errors.join("\n"), /notes are required/);
});

test("pilot evidence accepts a documented synthetic result", () => {
  const register = structuredClone(safeRegister);
  register.evidence[0] = {
    ...register.evidence[0],
    status: "passed",
    checkedAt: "2026-08-08T23:45:00.000Z",
    notes: "Regra conferida somente com dados sintéticos.",
  };
  const report = validatePilotEvidenceRegister(register, manifest);
  assert.equal(report.valid, true, report.errors.join("\n"));
});

