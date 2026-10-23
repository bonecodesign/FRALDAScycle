import assert from "node:assert/strict";
import test from "node:test";
import { runSyntheticIncidentDrill } from "../apps/api/incident-drill-runner.js";

const admin = { id: "11111111-1111-4111-8111-111111111111", role: "admin" };
const base = {
  confirmed: true, version: "pilot-bh-local-2026.10.23", environment: "isolated-local", syntheticDataOnly: true,
  domain: "payments", scenario: "Falha sintética impede uma compra fictícia sem criar cobrança.", severity: "high",
  roles: { triage: "Triagem fictícia", technical: "Técnico fictício", substitute: "Substituto fictício" },
  internalChannel: "canal-interno-sintético",
  recovery: { authorized: true, authorizedBy: "Responsável fictício", criterion: "Jornada sintética aprovada sem efeito externo." },
  findings: ["Bloqueio de novos compromissos confirmado."],
};

function controls() {
  let paused = false, version = 1;
  const changes = [];
  return {
    changes,
    service: {
      async change(_actor, input) { paused = input.action === "pause"; version++; changes.push(input); return { state: { domain: input.domain, paused, version } }; },
      async assertAvailable() { if (paused) throw Object.assign(new Error("paused"), { code: "operational_paused", status: 503 }); },
    },
    paused: () => paused,
  };
}

test("synthetic drill proves containment, safe continuation and authorized recovery", async () => {
  const state = controls(); let tick = 0;
  const record = await runSyntheticIncidentDrill({
    actor: admin, operationalControlService: state.service, input: base,
    clock: () => Date.parse("2026-10-23T10:00:00Z") + tick++ * 60_000,
    safeContinuationsProbe: async () => true, technicalRecoveryProbe: async () => true, postRecoveryProbe: async () => true,
  });
  assert.equal(state.paused(), false);
  assert.deepEqual(state.changes.map(value => value.action), ["pause", "resume"]);
  assert.equal(record.containment.auditAction, "operations.paused");
  assert.equal(record.recovery.auditAction, "operations.resumed");
  assert.ok(record.findings.some(value => /Nenhum fornecedor/.test(value)));
});

test("failed containment or recovery verification leaves the affected domain paused", async () => {
  for (const failing of ["safe", "recovery"]) {
    const state = controls();
    await assert.rejects(runSyntheticIncidentDrill({
      actor: admin, operationalControlService: state.service, input: base,
      safeContinuationsProbe: async () => failing !== "safe",
      technicalRecoveryProbe: async () => failing !== "recovery",
      postRecoveryProbe: async () => true,
    }), /remains paused/);
    assert.equal(state.paused(), true);
    assert.deepEqual(state.changes.map(value => value.action), ["pause"]);
  }
});

test("failed post-recovery verification automatically reapplies containment", async () => {
  const state = controls();
  await assert.rejects(runSyntheticIncidentDrill({
    actor: admin, operationalControlService: state.service, input: base,
    safeContinuationsProbe: async () => true, technicalRecoveryProbe: async () => true,
    postRecoveryProbe: async () => false,
  }), /rollback applied/);
  assert.equal(state.paused(), true);
  assert.deepEqual(state.changes.map(value => value.action), ["pause", "resume", "pause"]);
  assert.match(state.changes.at(-1).reason, /pausado novamente/);
});

test("drill is restricted to operations administrators and explicit synthetic confirmation", async () => {
  const state = controls();
  await assert.rejects(runSyntheticIncidentDrill({
    actor: { id: "customer", role: "customer" }, operationalControlService: state.service, input: base,
    safeContinuationsProbe: async () => true, technicalRecoveryProbe: async () => true, postRecoveryProbe: async () => true,
  }), error => error.code === "forbidden");
  await assert.rejects(runSyntheticIncidentDrill({
    actor: admin, operationalControlService: state.service, input: { ...base, syntheticDataOnly: false },
    safeContinuationsProbe: async () => true, technicalRecoveryProbe: async () => true, postRecoveryProbe: async () => true,
  }), error => error.code === "invalid_incident_drill_confirmation");
});
