import assert from "node:assert/strict";
import test from "node:test";
import { createAuthService, hashSessionToken } from "../apps/api/auth-service.js";
import { hashPassword } from "../apps/api/security.js";

test("elevated accounts require a short-lived second factor before session creation", async () => {
  const user = {
    id: "admin-1", email: "admin@example.test", phone: null,
    password_hash: await hashPassword("senha-administrativa-2026"), display_name: "Admin",
    role: "admin", email_verified_at: new Date(), disabled_at: null,
  };
  const tokens = new Map();
  const sessions = [];
  const attempts = [];
  let deliveredCode;
  const repository = {
    async findUserByContact() { return user; },
    async findUserById(id) { return id === user.id ? user : null; },
    async countRecentFailedAttempts(hash) {
      const key = hash.toString("hex");
      return attempts.filter((item) => item.key === key && !item.succeeded).length;
    },
    async recordLoginAttempt({ emailHash, succeeded }) {
      attempts.push({ key: emailHash.toString("hex"), succeeded });
    },
    async createAuthToken(value) { tokens.set(value.tokenHash.toString("hex"), value); },
    async consumeAuthToken({ tokenHash, kind }) {
      const key = tokenHash.toString("hex");
      const value = tokens.get(key);
      if (!value || value.kind !== kind) return null;
      tokens.delete(key);
      return value.userId;
    },
    async createSession(value) { sessions.push(value); return value; },
  };
  const service = createAuthService(repository, {
    notificationService: {
      async adminLoginChallenge(message) { deliveredCode = message.token; },
    },
  });

  const challenge = await service.login({ email: user.email, password: "senha-administrativa-2026" });
  assert.equal(challenge.mfaRequired, true);
  assert.equal(challenge.challenge.length >= 43, true);
  assert.equal(sessions.length, 0);
  assert.match(deliveredCode, /^\d{6}$/);

  await assert.rejects(
    service.confirmAdminMfa({ challenge: challenge.challenge, code: "000000" }),
    (error) => error.code === "invalid_mfa_code",
  );
  const authenticated = await service.confirmAdminMfa({ challenge: challenge.challenge, code: deliveredCode });
  assert.equal(authenticated.user.role, "admin");
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].tokenHash.equals(hashSessionToken(authenticated.token)), true);
  await assert.rejects(
    service.confirmAdminMfa({ challenge: challenge.challenge, code: deliveredCode }),
    (error) => error.code === "invalid_mfa_code",
  );
});
