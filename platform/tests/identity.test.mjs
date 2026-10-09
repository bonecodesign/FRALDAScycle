import assert from "node:assert/strict";
import test from "node:test";
import { createAuthService, AuthError, hashSessionToken, normalizeEmail, normalizePhone } from "../apps/api/auth-service.js";
import { createVerificationCode } from "../apps/api/security.js";
import { clearSessionCookie, readSessionCookie, sessionCookie } from "../apps/api/cookies.js";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";
const adultRegistration = { adultConfirmed: true, adultDeclarationVersion: "FC-AGE-1" };

function repository() {
  const users = new Map();
  const sessions = new Map();
  return {
    async createUser(input) {
      if (users.has(input.email)) {
        const error = new Error("duplicate");
        error.code = "23505";
        error.constraint = "users_email_unique";
        throw error;
      }
      const user = {
        id: crypto.randomUUID(), email: input.email, phone: input.phone,
        password_hash: input.passwordHash, display_name: input.displayName,
        role: "customer", email_verified_at: null, disabled_at: null,
        adult_declaration_version: input.adultDeclarationVersion, adult_declared_at: new Date(),
      };
      users.set(user.email, user);
      return user;
    },
    async createUserWithVerification(input) {
      const user = await this.createUser(input);
      await this.createAuthToken({ userId: user.id, kind: 'email_verification',
        tokenHash: input.verification.tokenHash, expiresAt: input.verification.expiresAt,
        notification: { token: input.verification.token } });
      return user;
    },
    findUserByContact({ email, phone }) {
      return [...users.values()].find((user) => (email && user.email === email) || (phone && user.phone === phone)) ?? null;
    },
    async createSession(input) {
      sessions.set(input.tokenHash.toString("hex"), input);
      return input;
    },
    async findActiveSession(tokenHash) {
      const session = sessions.get(tokenHash.toString("hex"));
      if (!session) return null;
      const user = [...users.values()].find(({ id }) => id === session.userId);
      return { ...user, display_name: user.display_name };
    },
    async revokeSession(tokenHash) { return sessions.delete(tokenHash.toString("hex")); },
    tokens: new Map(),
    queued: [],
    attempts: new Map(),
    async reservePasswordRecoveryRequest() { return true; },
    async reserveVerificationRequest() { return true; },
    async confirmVerificationToken({ tokenHash }) {
      const id = await this.consumeAuthToken({ tokenHash, kind: 'email_verification' });
      return { user: id ? await this.markEmailVerified(id) : null };
    },
    async createAuthToken(input) {
      this.tokens.set(input.tokenHash.toString("hex"), input);
      if (input.notification) this.queued.push({ kind: input.kind, ...input.notification });
      return 'token-id';
    },
    async consumeAuthToken({ tokenHash, kind }) {
      const key = tokenHash.toString("hex");
      const value = this.tokens.get(key);
      if (!value || value.kind !== kind || value.expiresAt <= new Date()) return null;
      this.tokens.delete(key);
      return value.userId;
    },
    async markEmailVerified(userId) {
      const user = [...users.values()].find(({ id }) => id === userId);
      user.email_verified_at = new Date();
      return user;
    },
    async resetPasswordWithToken({ tokenHash, passwordHash }) {
      const userId = await this.consumeAuthToken({ tokenHash, kind: "password_recovery" });
      if (!userId) return null;
      const user = [...users.values()].find(({ id }) => id === userId);
      user.password_hash = passwordHash;
      for (const [key, value] of sessions) if (value.userId === userId) sessions.delete(key);
      return userId;
    },
    async recordLoginAttempt({ emailHash, succeeded }) {
      const key = emailHash.toString("hex");
      const values = this.attempts.get(key) ?? [];
      values.push(succeeded);
      this.attempts.set(key, values);
    },
    async countRecentFailedAttempts(emailHash) {
      return (this.attempts.get(emailHash.toString("hex")) ?? []).filter((value) => !value).length;
    },
  };
}

test("normalizes identity without weakening validation", () => {
  assert.equal(normalizeEmail(" Ana@Example.COM "), "ana@example.com");
  assert.equal(normalizePhone("(31) 99900-0000"), "31999000000");
});

test("register login session and logout form a revocable journey", async () => {
  const auth = createAuthService(repository(), { sessionTtlSeconds: 3600 });
  const registered = await auth.register({
    ...adultRegistration, email: "ana@example.com", displayName: "Ana Souza", password: "senha-segura-2026",
  });
  assert.equal(registered.verificationRequired, true);
  assert.equal(registered.user.emailVerified, false);

  const login = await auth.login({ email: "ANA@example.com", password: "senha-segura-2026" });
  assert.ok(login.token.length >= 43);
  assert.equal((await auth.session(login.token)).email, "ana@example.com");
  assert.equal(await auth.logout(login.token), true);
  assert.equal(await auth.session(login.token), null);
});

test("authentication errors are explicit without leaking password state", async () => {
  const auth = createAuthService(repository());
  await assert.rejects(
    auth.register({ email: "adult@example.com", displayName: "Pessoa Adulta", password: "senha-segura-2026" }),
    (error) => error instanceof AuthError && error.code === "adult_declaration_required" && error.status === 422,
  );
  await assert.rejects(
    auth.register({ ...adultRegistration, email: "inválido", displayName: "A", password: "curta" }),
    (error) => error instanceof AuthError && error.code === "invalid_email",
  );
  await assert.rejects(
    auth.login({ email: "missing@example.com", password: "qualquer-senha" }),
    (error) => error.code === "invalid_credentials" && error.status === 401,
  );
});

test("session cookies are HttpOnly, scoped and revocable", () => {
  const value = sessionCookie("token seguro", { secure: true, maxAge: 3600 });
  assert.match(value, /HttpOnly/);
  assert.match(value, /SameSite=Lax/);
  assert.match(value, /Secure/);
  assert.equal(readSessionCookie(value), "token seguro");
  assert.match(clearSessionCookie(), /Max-Age=0/);
  assert.equal(hashSessionToken("same").equals(hashSessionToken("same")), true);
});

test("HTTP identity contract keeps the session token out of JSON", async (context) => {
  const calls = [];
  const authService = {
    async register(input) {
      calls.push(["register", input]);
      return { user: { id: "user-1", email: input.email }, verificationRequired: true };
    },
    async login(input) {
      calls.push(["login", input]);
      return {
        token: "opaque-session-token",
        expiresAt: new Date("2026-09-01T00:00:00Z"),
        user: { id: "user-1", email: input.email },
      };
    },
    async session(token) {
      calls.push(["session", token]);
      return token === "opaque-session-token" ? { id: "user-1", email: "ana@example.com" } : null;
    },
    async logout(token) {
      calls.push(["logout", token]);
      return true;
    },
  };
  const server = createApiServer({
    config: loadConfig({ NODE_ENV: "test", SESSION_TTL_SECONDS: "3600" }),
    authService,
  });
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  context.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  const registration = await fetch(`${origin}/v1/auth/register`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "ana@example.com", displayName: "Ana", password: "senha-segura-2026" }),
  });
  assert.equal(registration.status, 201);

  const login = await fetch(`${origin}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "ana@example.com", password: "senha-segura-2026" }),
  });
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  assert.equal("token" in loginBody, false);
  const cookie = login.headers.get("set-cookie");
  assert.match(cookie, /fc_session=opaque-session-token/);
  assert.match(cookie, /HttpOnly/);

  const session = await fetch(`${origin}/v1/auth/session`, {
    headers: { cookie: "fc_session=opaque-session-token" },
  });
  assert.equal(session.status, 200);

  const logout = await fetch(`${origin}/v1/auth/logout`, {
    method: "POST", headers: { cookie: "fc_session=opaque-session-token" },
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
  assert.deepEqual(calls.map(([name]) => name), ["register", "login", "session", "logout"]);
});

test("HTTP identity rejects malformed and oversized payloads safely", async (context) => {
  const server = createApiServer({
    config: loadConfig({ NODE_ENV: "test" }),
    authService: { register() { throw new Error("must not be called"); } },
  });
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  context.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  const malformed = await fetch(`${origin}/v1/auth/register`, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, "invalid_json");

  const wrongType = await fetch(`${origin}/v1/auth/register`, {
    method: "POST", headers: { "content-type": "text/plain" }, body: "{}",
  });
  assert.equal(wrongType.status, 415);
});

test("verification and recovery use one-time tokens and revoke sessions", async () => {
  const data = repository();
  const auth = createAuthService(data);
  const registered = await auth.register({
    ...adultRegistration, email: "bia@example.com", displayName: "Bia Lima", password: "senha-segura-2026",
  });
  assert.equal(data.queued[0].kind, "email_verification");
  const verificationToken = data.queued[0].token;
  assert.equal((await auth.verifyEmail({ token: verificationToken, challenge: registered.challenge })).user.emailVerified, true);
  await assert.rejects(auth.verifyEmail({ token: verificationToken, challenge: registered.challenge }), /inválido ou expirado/i);

  const login = await auth.login({ email: "bia@example.com", password: "senha-segura-2026" });
  const { challenge } = await auth.requestPasswordRecovery({ email: "bia@example.com" });
  const recoveryToken = data.queued.at(-1).token;
  assert.deepEqual(await auth.resetPassword({ token: recoveryToken, challenge, password: "nova-senha-segura-2026" }), { success: true });
  assert.equal(await auth.session(login.token), null);
  await assert.rejects(
    auth.login({ email: "bia@example.com", password: "senha-segura-2026" }),
    (error) => error.code === "invalid_credentials",
  );
  assert.ok((await auth.login({ email: "bia@example.com", password: "nova-senha-segura-2026" })).token);
});

test("recovery requests do not reveal whether an account exists", async () => {
  const auth = createAuthService(repository());
  const result = await auth.requestPasswordRecovery({ email: "nobody@example.com" });
  assert.equal(result.accepted, true);
  assert.match(result.challenge, /^[A-Za-z0-9_-]{43}$/);
  const verification = await auth.requestVerification({ email: 'nobody@example.com' });
  assert.equal(verification.accepted, true); assert.match(verification.challenge, /^[A-Za-z0-9_-]{43}$/);
});

test("login attempts are limited per normalized identity", async () => {
  const auth = createAuthService(repository(), { maxLoginAttempts: 2 });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await assert.rejects(
      auth.login({ email: "blocked@example.com", password: "senha-incorreta" }),
      (error) => error.code === "invalid_credentials",
    );
  }
  await assert.rejects(
    auth.login({ email: "BLOCKED@example.com", password: "senha-incorreta" }),
    (error) => error.code === "too_many_attempts" && error.status === 429,
  );
});

test("phone-only identity preserves the approved email-or-phone contract", async () => {
  const auth = createAuthService(repository());
  const registered = await auth.register({
    ...adultRegistration, phone: "(31) 99900-0000", displayName: "Caio Lima", password: "senha-segura-2026",
  });
  assert.equal(registered.user.phone, "31999000000");
  assert.equal(registered.user.email, null);
  const login = await auth.login({ phone: "31 99900-0000", password: "senha-segura-2026" });
  assert.ok(login.token);
});

test("approved verification codes contain exactly six numeric digits", () => {
  for (let index = 0; index < 20; index += 1) assert.match(createVerificationCode(), /^\d{6}$/);
});

test('registration distinguishes contact conflicts from verification collisions', async () => {
  for (const constraint of ['users_email_unique', 'users_phone_unique', 'auth_tokens_token_hash_key']) {
    const collision = Object.assign(new Error('synthetic uniqueness conflict'), { code: '23505', constraint });
    const auth = createAuthService({ async createUserWithVerification() { throw collision; } });
    await assert.rejects(auth.register({ ...adultRegistration, email: 'collision@example.test', displayName: 'Pessoa fictícia', password: 'senha-segura-2026' }),
      error => constraint === 'auth_tokens_token_hash_key' ? error === collision : error.code === 'account_exists' && error.status === 409);
  }
});
