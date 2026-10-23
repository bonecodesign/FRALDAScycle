import assert from "node:assert/strict";
import test from "node:test";
import { createAuthService } from "../apps/api/auth-service.js";
import { pilotBhConfig } from "../apps/api/pilot-bh.js";

const pilot = pilotBhConfig({ PILOT_BH_ENABLED: "true", PILOT_BH_INVITED_EMAILS: "bootstrap@example.test" });
const token = "c".repeat(43);

test("database-backed pilot invitation is consumed through the atomic registration repository method", async () => {
  let invitedInput;
  const service = createAuthService({
    async createInvitedUserWithVerification(input) {
      invitedInput = input;
      return { id: "11111111-1111-4111-8111-111111111111", email: input.email, phone: null,
        display_name: input.displayName, role: "customer", email_verified_at: null, adult_declared_at: new Date() };
    },
  }, { pilotBh: pilot });
  const result = await service.register({
    email: "convidada@example.test", displayName: "Pessoa Convidada", password: "senha-segura-completa",
    adultConfirmed: true, adultDeclarationVersion: "FC-AGE-1", pilotInvitationToken: token,
  });
  assert.equal(result.user.email, "convidada@example.test");
  assert.ok(Buffer.isBuffer(invitedInput.invitation.tokenHash));
  assert.equal(Object.hasOwn(invitedInput.invitation, "token"), false);
});

test("pilot registration rejects missing or unavailable database invitation without creating an account", async () => {
  let writes = 0;
  const service = createAuthService({
    async createInvitedUserWithVerification() { writes++; throw Object.assign(new Error("unavailable"), { code: "pilot_invitation_unavailable" }); },
  }, { pilotBh: pilot });
  const base = { email: "convidada@example.test", displayName: "Pessoa Convidada", password: "senha-segura-completa",
    adultConfirmed: true, adultDeclarationVersion: "FC-AGE-1" };
  await assert.rejects(service.register(base), error => error.code === "pilot_invitation_required" && error.status === 403);
  assert.equal(writes, 0);
  await assert.rejects(service.register({ ...base, pilotInvitationToken: token }),
    error => error.code === "pilot_invitation_required" && error.status === 403);
  assert.equal(writes, 1);
});

test("a consumed database invitation preserves login and existing sessions for its admitted user", async () => {
  const user = { id: "11111111-1111-4111-8111-111111111111", email: "convidada@example.test", phone: null,
    display_name: "Pessoa Convidada", role: "customer", email_verified_at: new Date(), adult_declared_at: new Date(),
    password_hash: "scrypt$16384$8$1$invalid", disabled_at: null };
  const service = createAuthService({
    async findActiveSession() { return user; },
    async pilotAdmissionForUser(id) { return id === user.id; },
  }, { pilotBh: pilot });
  assert.equal((await service.session("session-token"))?.id, user.id);
});
