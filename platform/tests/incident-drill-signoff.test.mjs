import assert from "node:assert/strict";
import test from "node:test";
import { createIncidentDrillEvidence } from "../apps/api/incident-drill-evidence.js";
import { assessIncidentDrillSignoff } from "../apps/api/incident-drill-signoff.js";

const evidence = createIncidentDrillEvidence({
  version: "pilot-bh-local-2026.10.23", environment: "isolated-local", syntheticDataOnly: true,
  startedAt: "2026-10-23T10:00:00.000Z", scenario: "Falha sintética impede uma compra fictícia sem cobrança.", severity: "high",
  roles: { triage: "Triagem interna", technical: "Responsável técnico", substitute: "Substituto técnico" },
  internalChannel: "canal-interno-sintético",
  containment: { domain: "payments", version: 2, auditAction: "operations.paused", reason: "Contenção sintética confirmada no ambiente local." },
  recovery: { authorized: true, authorizedBy: "Responsável interno", recoveredAt: "2026-10-23T10:10:00.000Z", auditAction: "operations.resumed", criterion: "Jornada sintética aprovada sem efeito externo." },
  findings: ["Bloqueio de novos compromissos confirmado."],
});
const complete = {
  evidence, humanObserved: true,
  roleAcceptances: [
    { role: "triage", participantRef: "internal:triage", accepted: true, acceptedAt: "2026-10-23T09:00:00Z" },
    { role: "technical", participantRef: "internal:technical", accepted: true, acceptedAt: "2026-10-23T09:01:00Z" },
    { role: "substitute", participantRef: "internal:substitute", accepted: true, acceptedAt: "2026-10-23T09:02:00Z" },
  ],
  observation: { observerRef: "internal:observer", observedAt: "2026-10-23T10:15:00Z" },
  decision: { outcome: "passed", decidedByRef: "internal:founder", decidedAt: "2026-10-23T10:20:00Z", rationale: "Todos os critérios internos do exercício foram observados." },
  findings: [],
};
const clock = () => Date.parse("2026-10-23T11:00:00Z");

test("requires human roles, independent observation and a formal decision", () => {
  assert.deepEqual(assessIncidentDrillSignoff(complete, clock), {
    status: "complete", launchAuthorized: false, blockers: [],
    notice: "Exercício humano registrado; a autorização de lançamento permanece em portão separado.",
  });
});

test("technical automation alone cannot complete the human exercise", () => {
  const result = assessIncidentDrillSignoff({ evidence }, clock);
  assert.equal(result.status, "pending");
  assert.equal(result.launchAuthorized, false);
  assert.ok(result.blockers.includes("human_observation_required"));
  assert.ok(result.blockers.includes("triage_acceptance_required"));
  assert.ok(result.blockers.includes("formal_decision_required"));
});

test("rejects tampering, accumulated roles and unresolved high-risk findings", () => {
  const result = assessIncidentDrillSignoff({
    ...complete,
    evidence: { ...evidence, sha256: "0".repeat(64) },
    roleAcceptances: complete.roleAcceptances.map(item => ({ ...item, participantRef: "internal:same-person" })),
    observation: { observerRef: "internal:same-person", observedAt: "2026-10-23T10:15:00Z" },
    findings: [{ severity: "critical", status: "open" }],
  }, clock);
  assert.equal(result.status, "pending");
  assert.ok(result.blockers.includes("verified_technical_evidence_required"));
  assert.ok(result.blockers.includes("distinct_role_holders_required"));
  assert.ok(result.blockers.includes("independent_observer_required"));
  assert.ok(result.blockers.includes("high_risk_findings_must_be_resolved"));
});
