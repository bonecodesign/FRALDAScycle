import assert from "node:assert/strict";
import test from "node:test";
import { createIncidentDrillEvidence, verifyIncidentDrillEvidence } from "../apps/api/incident-drill-evidence.js";

const record = {
  version: "pilot-bh-local-2026.10.23", environment: "isolated-local", syntheticDataOnly: true,
  startedAt: "2026-10-23T10:00:00.000Z", scenario: "Falha sintética impede uma compra fictícia sem cobrança.", severity: "high",
  roles: { triage: "Triagem fictícia", technical: "Técnico fictício", substitute: "Substituto fictício" },
  internalChannel: "canal-interno-sintético",
  containment: { domain: "payments", version: 2, auditAction: "operations.paused", reason: "Contenção sintética confirmada no ambiente local." },
  recovery: { authorized: true, authorizedBy: "Responsável fictício", recoveredAt: "2026-10-23T10:10:00.000Z", auditAction: "operations.resumed", criterion: "Jornada sintética aprovada sem efeito externo." },
  findings: ["Bloqueio de novos compromissos confirmado."],
};

test("creates a verifiable, explicitly limited evidence envelope", () => {
  const evidence = createIncidentDrillEvidence(record);
  assert.equal(evidence.schema, "fraldacycle.incident-drill-evidence.v1");
  assert.match(evidence.sha256, /^[a-f0-9]{64}$/);
  assert.equal(verifyIncidentDrillEvidence(evidence), true);
  assert.ok(evidence.limitations.some(value => /não comprova exercício humano/i.test(value)));
});

test("detects changes to incident evidence", () => {
  const evidence = createIncidentDrillEvidence(record);
  assert.equal(verifyIncidentDrillEvidence({ ...evidence, record: { ...evidence.record, severity: "critical" } }), false);
  assert.equal(verifyIncidentDrillEvidence({ ...evidence, sha256: "0".repeat(64) }), false);
  assert.equal(verifyIncidentDrillEvidence({ ...evidence, schema: "unknown" }), false);
});
