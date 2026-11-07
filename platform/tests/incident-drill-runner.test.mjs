import assert from "node:assert/strict";
import test from "node:test";
import { runSyntheticIncidentDrill } from "../apps/api/incident-drill-runner.js";
import { createOperationalControlService } from "../apps/api/operational-control.js";

const admin = { id: "11111111-1111-4111-8111-111111111111", role: "admin", staffSector: "operations", staffAccessLevel: 4 };
const founder = { id: "22222222-2222-4222-8222-222222222222", role: "admin", staffSector: "founder", staffAccessLevel: 5 };
const technicalGrantId = "33333333-3333-4333-8333-333333333333";
const founderGrantId = "44444444-4444-4444-8444-444444444444";
const requestId = "55555555-5555-4555-8555-555555555555";
const base = {
  confirmed: true, version: "pilot-bh-local-2026.10.23", environment: "isolated-local", syntheticDataOnly: true,
  domain: "payments", scenario: "Falha sintética impede uma compra fictícia sem criar cobrança.", severity: "high",
  roles: { triage: "Triagem fictícia", technical: "Técnico fictício", substitute: "Substituto fictício" },
  internalChannel: "canal-interno-sintético",
  recovery: { authorized: true, criterion: "Jornada sintética aprovada sem efeito externo." },
  findings: ["Bloqueio de novos compromissos confirmado."],
};

function controls({ proposalError = null, decisionError = null, decisionStatus = "approved" } = {}) {
  let paused = false, version = 1, proposal;
  const events = [];
  const repository = {
    async change({ actorUserId, domain, paused: next, reason }) {
      paused = next;
      version++;
      events.push({ action: next ? "pause" : "direct-resume", actorUserId, domain, reason });
      if (!next) throw new Error("Direct resume is forbidden in this test");
      return { domain, paused, version };
    },
    async blocked(domain) { return paused ? { domain } : null; },
    async proposeResume({ actorUserId, domain, reason, grantId }) {
      if (proposalError) throw proposalError;
      if (!paused) throw new Error("Domain is not paused");
      events.push({ action: "propose", actorUserId, domain, reason, grantId });
      proposal = { id: requestId, domain, proposed_by: actorUserId, expected_version: version, status: "pending" };
      return proposal;
    },
    async decideResume({ actorUserId, requestId: id, approved, reason, grantId }) {
      if (decisionError) throw decisionError;
      if (id !== requestId || !proposal || actorUserId === proposal.proposed_by) throw new Error("Invalid independent approval");
      events.push({ action: "decide", actorUserId, approved, reason, grantId });
      if (!approved || decisionStatus !== "approved") {
        return { request: { ...proposal, status: approved ? decisionStatus : "rejected" }, state: null };
      }
      if (!paused || version !== proposal.expected_version) {
        return { request: { ...proposal, status: "superseded" }, state: null };
      }
      paused = false;
      version++;
      return { request: { ...proposal, status: "approved" }, state: { domain: proposal.domain, paused, version } };
    },
  };
  return { events, service: createOperationalControlService(repository), paused: () => paused };
}

function drill(state, overrides = {}) {
  return runSyntheticIncidentDrill({
    actor: admin, founder, operationalControlService: state.service,
    input: base, technicalGrantId, founderGrantId,
    safeContinuationsProbe: async () => true,
    technicalRecoveryProbe: async () => true,
    postRecoveryProbe: async () => true,
    ...overrides,
  });
}

test("synthetic drill uses independent approval grants before resuming", async () => {
  const state = controls(); let tick = 0;
  const record = await drill(state, {
    clock: () => Date.parse("2026-10-23T10:00:00Z") + tick++ * 60_000,
  });
  assert.equal(state.paused(), false);
  assert.deepEqual(state.events.map(value => value.action), ["pause", "propose", "decide"]);
  assert.equal(state.events[1].actorUserId, admin.id);
  assert.equal(state.events[1].grantId, technicalGrantId);
  assert.equal(state.events[2].actorUserId, founder.id);
  assert.equal(state.events[2].grantId, founderGrantId);
  assert.equal(record.recovery.authorizedBy, founder.id);
  assert.equal(record.containment.auditAction, "operations.paused");
  assert.equal(record.recovery.auditAction, "operations.resumed");
  assert.ok(record.findings.some(value => /Nenhum fornecedor/.test(value)));
});

test("failed containment or recovery probes leave the domain paused without proposing recovery", async () => {
  for (const failing of ["safe", "recovery"]) {
    const state = controls();
    await assert.rejects(drill(state, {
      safeContinuationsProbe: async () => failing !== "safe",
      technicalRecoveryProbe: async () => failing !== "recovery",
    }), /remains paused/);
    assert.equal(state.paused(), true);
    assert.deepEqual(state.events.map(value => value.action), ["pause"]);
  }
});

test("failed post-recovery verification automatically reapplies containment", async () => {
  const state = controls();
  await assert.rejects(drill(state, {
    postRecoveryProbe: async () => false,
  }), /rollback applied/);
  assert.equal(state.paused(), true);
  assert.deepEqual(state.events.map(value => value.action), ["pause", "propose", "decide", "pause"]);
  assert.match(state.events.at(-1).reason, /pausado novamente/);
});

test("failed, rejected or superseded independent approval never resumes operations", async () => {
  for (const options of [
    { proposalError: new Error("Proposal unavailable") },
    { decisionError: new Error("Founder verification unavailable") },
    { decisionStatus: "rejected" },
    { decisionStatus: "superseded" },
  ]) {
    const state = controls(options);
    await assert.rejects(drill(state), /Proposal unavailable|Founder verification unavailable|remains paused/);
    assert.equal(state.paused(), true);
    assert.equal(state.events.some(value => value.action === "direct-resume"), false);
  }
});

test("invalid actor, non-independent founder or missing grants fail before pausing", async () => {
  const cases = [
    { actor: { id: "customer", role: "customer" } },
    { founder: admin },
    { founder: { ...founder, staffAccessLevel: 4 } },
    { founder: { ...founder, staffSector: "operations" } },
    { founderGrantId: undefined },
    { technicalGrantId: "not-a-grant" },
    { input: { ...base, syntheticDataOnly: false } },
    { input: { ...base, recovery: { authorized: false, criterion: "No approval." } } },
    { input: { ...base, scenario: "short" } },
  ];
  for (const overrides of cases) {
    const state = controls();
    await assert.rejects(drill(state, overrides));
    assert.equal(state.paused(), false);
    assert.deepEqual(state.events, []);
  }
});

test("missing joint approval interface is rejected before modifying the domain", async () => {
  const state = controls();
  await assert.rejects(drill(state, {
    operationalControlService: {
      change: state.service.change,
      assertAvailable: state.service.assertAvailable,
    },
  }), /requires the joint resume approval service/);
  assert.equal(state.paused(), false);
});
