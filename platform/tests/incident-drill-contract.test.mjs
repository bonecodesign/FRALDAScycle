import assert from "node:assert/strict";
import test from "node:test";
import { localIncidentDrill } from "../packages/contracts/incident-drill.js";

const record = () => ({
  version: "local-test-2026.10.21", environment: "isolated-local", syntheticDataOnly: true,
  startedAt: "2026-10-21T13:00:00Z", scenario: "Falha sintética de cobrança impede uma compra fictícia.", severity: "high",
  roles: { triage: "Pessoa de triagem fictícia", technical: "Pessoa técnica fictícia", substitute: "Substituto fictício" },
  internalChannel: "canal-interno-sintético",
  containment: { domain: "payments", version: 2, auditAction: "operations.paused", reason: "Suspeita sintética de cobrança incorreta." },
  recovery: { authorized: true, authorizedBy: "Responsável fictício", recoveredAt: "2026-10-21T14:00:00Z", auditAction: "operations.resumed", criterion: "Nova intenção sintética aprovada sem ação externa." },
  findings: ["Nenhuma cobrança externa foi executada."],
});

test("local incident drill requires roles, pause and authorized recovery evidence", () => {
  const result = localIncidentDrill(record());
  assert.equal(result.containment.domain, "payments");
  assert.equal(result.containment.auditAction, "operations.paused");
  assert.equal(result.recovery.auditAction, "operations.resumed");
  assert.equal(result.syntheticDataOnly, true);
  for (const mutate of [
    value => { value.roles.triage = ""; },
    value => { value.containment.auditAction = "operations.resumed"; },
    value => { value.recovery.authorized = false; },
    value => { value.environment = "production"; },
    value => { value.recovery.recoveredAt = "2026-10-21T12:00:00Z"; },
  ]) {
    const invalid = record(); mutate(invalid); assert.throws(() => localIncidentDrill(invalid));
  }
});

test("local incident drill rejects fields that could capture credentials or documents", () => {
  for (const extra of [{ token: "value" }, { evidence: { password: "value" } }, { userDocument: "value" }]) {
    assert.throws(() => localIncidentDrill({ ...record(), ...extra }), /Sensitive field/);
  }
});
