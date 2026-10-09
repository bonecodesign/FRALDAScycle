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
    async createAuthToken(value) {
      tokens.set(value.tokenHash.toString("hex"), value);
      deliveredCode = value.notification.token;
      return 'token-id';
    },
    async consumeAuthToken({ tokenHash, kind }) {
      const key = tokenHash.toString("hex");
      const value = tokens.get(key);
      if (!value || value.kind !== kind) return null;
      tokens.delete(key);
      return value.userId;
    },
    async createSession(value) { sessions.push(value); return value; },
    async confirmAdminMfaSession({tokenHash,attemptHash,maxAttempts,sessionTokenHash,expiresAt}){
      if(await this.countRecentFailedAttempts(attemptHash)>=maxAttempts)return {limited:true};
      const id=await this.consumeAuthToken({tokenHash,kind:'admin_login_mfa'});
      await this.recordLoginAttempt({emailHash:attemptHash,succeeded:Boolean(id)});
      if(!id)return {user:null};
      await this.createSession({userId:id,tokenHash:sessionTokenHash,expiresAt});
      return {user};
    },
  };
  const service = createAuthService(repository);

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

test('admin login returns no challenge or session when atomic issuance is rejected or fails', async () => {
  const user = { id: 'admin-atomic', email: 'atomic@example.test', role: 'admin', password_hash: await hashPassword('senha-administrativa-2026') };
  const repository = {
    async findUserByContact() { return user; },
    async countRecentFailedAttempts() { return 0; },
    async recordLoginAttempt() {},
    async createAuthToken() { return null; },
    async createSession() { assert.fail('session must require a completed challenge'); },
  };
  const service = createAuthService(repository);
  await assert.rejects(service.login({ email: user.email, password: 'senha-administrativa-2026' }), error => error.code === 'invalid_credentials');
  repository.createAuthToken = async () => { throw new Error('synthetic queue failure'); };
  await assert.rejects(service.login({ email: user.email, password: 'senha-administrativa-2026' }), /synthetic queue failure/);
});
