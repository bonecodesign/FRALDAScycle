import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createPilotInvitationService } from "../apps/api/pilot-invitation-service.js";

const admin = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "admin" };
const moderator = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", role: "moderator" };
const now = Date.parse("2030-01-01T12:00:00Z");
const token = "a".repeat(43);

test("authorized administration issues a one-time token while persistence receives only its digest", async () => {
  let saved;
  const service = createPilotInvitationService({
    async issue(input) { saved = input; return { invitation: { id: "invite-1", email: input.email }, reused: false }; },
  }, { clock: () => now, tokenFactory: () => token });
  const result = await service.issue(admin, {
    email: " Piloto@Example.Test ", purpose: "Acesso sintético controlado ao piloto BH.",
    expiresAt: "2030-01-08T12:00:00Z", requestReference: "pilot-invite-request-0001",
  });
  assert.equal(result.token, token);
  assert.equal(result.delivered, false);
  assert.equal(saved.email, "piloto@example.test");
  assert.deepEqual(saved.tokenHash, createHash("sha256").update(token).digest());
  assert.equal(Object.hasOwn(saved, "token"), false);
});

test("an idempotent replay never exposes a newly generated token", async () => {
  const service = createPilotInvitationService({
    async issue() { return { invitation: { id: "invite-1" }, reused: true }; },
  }, { clock: () => now, tokenFactory: () => token });
  const result = await service.issue(admin, {
    email: "piloto@example.test", purpose: "Acesso sintético controlado ao piloto BH.",
    expiresAt: "2030-01-08T12:00:00Z", requestReference: "pilot-invite-request-0001",
  });
  assert.equal(result.token, null);
  assert.equal(result.reused, true);
});

test("moderators may list invitations but cannot issue or revoke them", async () => {
  const service = createPilotInvitationService({ async list({ limit }) { return [{ limit }]; } }, { clock: () => now });
  assert.deepEqual(await service.list(moderator, { limit: "10" }), [{ limit: 10 }]);
  await assert.rejects(service.issue(moderator, {}), error => error.code === "forbidden" && error.status === 403);
  await assert.rejects(service.revoke(moderator, admin.id, { reason: "Revogação sintética justificada." }),
    error => error.code === "forbidden" && error.status === 403);
});

test("revocation requires a valid identifier and auditable reason", async () => {
  let received;
  const service = createPilotInvitationService({ async revoke(input) { received = input; return { id: input.invitationId }; } }, { clock: () => now });
  await assert.rejects(service.revoke(admin, "invalid", { reason: "Motivo suficientemente longo." }), /convite e justificativa/i);
  await service.revoke(admin, "cccccccc-cccc-4ccc-8ccc-cccccccccccc", { reason: "Conta removida da sessão privada autorizada." });
  assert.equal(received.actorId, admin.id);
  assert.equal(received.now, "2030-01-01T12:00:00.000Z");
});
