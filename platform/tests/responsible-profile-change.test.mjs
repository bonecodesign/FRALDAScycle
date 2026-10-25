import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword } from "../apps/api/security.js";
import { createResponsibleProfileChangeService } from "../apps/api/responsible-profile-change-service.js";
import { validateResponsibleProfileChange } from "../packages/contracts/responsible-profile-change.js";

const actor = { id: "10000000-0000-4000-8000-000000000001" };

test("contrato exige nome completo, data real e maioridade exata", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  assert.deepEqual(validateResponsibleProfileChange({ fullName: "  Maria   da Silva ", birthDate: "2008-10-25" }, { now }),
    { fullName: "Maria da Silva", birthDate: "2008-10-25" });
  assert.throws(() => validateResponsibleProfileChange({ fullName: "Maria", birthDate: "2008-10-25" }, { now }), /nome completo/);
  assert.throws(() => validateResponsibleProfileChange({ fullName: "Maria da Silva", birthDate: "2008-10-26" }, { now }),
    error => error.code === "responsible_must_be_adult");
  assert.throws(() => validateResponsibleProfileChange({ fullName: "Maria da Silva", birthDate: "2000-02-30" }, { now }),
    error => error.code === "invalid_birth_date");
});

test("solicitação exige senha e e-mail verificado e não expõe o código", async () => {
  const passwordHash = await hashPassword("uma frase senha segura");
  let issued;
  const service = createResponsibleProfileChangeService({
    async account() { return { email: "maria@example.test", email_verified_at: new Date(), password_hash: passwordHash,
      responsible_registration_completed_at: new Date() }; },
    async issue(input) { issued = input; },
  });
  const result = await service.request(actor, { password: "uma frase senha segura",
    change: { fullName: "Maria de Souza", birthDate: "1990-05-12" } });
  assert.equal(result.accepted, true);
  assert.match(result.challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.equal("code" in result, false);
  assert.match(issued.code, /^\d{6}$/);
  assert.equal(issued.challengeHash.length, 32);
  assert.equal(issued.tokenHash.length, 32);
  assert.equal(issued.changeHash.length, 32);
  assert.equal("change" in issued, false);

  await assert.rejects(createResponsibleProfileChangeService({ async account() { return {
    email: "maria@example.test", email_verified_at: new Date(), password_hash: passwordHash,
    responsible_registration_completed_at: new Date() }; } }).request(actor, {
    password: "senha incorreta longa", change: { fullName: "Maria de Souza", birthDate: "1990-05-12" },
  }), error => error.code === "invalid_credentials");
});

test("confirmação é vinculada ao usuário, desafio e código e limita tentativas", async () => {
  const calls = [];
  const service = createResponsibleProfileChangeService({ async confirm(input) { calls.push(input); return { success: true }; } });
  const change = { fullName: "Maria de Souza", birthDate: "1990-05-12" };
  const result = await service.confirm(actor, { challenge: "a".repeat(43), code: "123456", change });
  assert.equal(result.success, true);
  assert.equal(calls[0].userId, actor.id);
  assert.equal(calls[0].challengeHash.length, 32);
  assert.equal(calls[0].tokenHash.length, 32);
  assert.deepEqual(calls[0].change, change);
  await assert.rejects(service.confirm(actor, { challenge: "invalid", code: "123456", change }),
    error => error.code === "invalid_responsible_change_code");
  const limited = createResponsibleProfileChangeService({ async confirm() { return { limited: true }; } });
  await assert.rejects(limited.confirm(actor, { challenge: "a".repeat(43), code: "123456", change }),
    error => error.code === "too_many_attempts" && error.status === 429);
});
