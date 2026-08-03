import assert from "node:assert/strict";
import test from "node:test";
import { createAuthService, AuthError, hashSessionToken, normalizeEmail } from "../apps/api/auth-service.js";
import { clearSessionCookie, readSessionCookie, sessionCookie } from "../apps/api/cookies.js";

function repository() {
  const users = new Map();
  const sessions = new Map();
  return {
    async createUser(input) {
      if (users.has(input.email)) {
        const error = new Error("duplicate");
        error.code = "23505";
        throw error;
      }
      const user = {
        id: crypto.randomUUID(), email: input.email, phone: input.phone,
        password_hash: input.passwordHash, display_name: input.displayName,
        role: "customer", email_verified_at: null, disabled_at: null,
      };
      users.set(user.email, user);
      return user;
    },
    findUserByEmail(email) { return users.get(email) ?? null; },
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
  };
}

test("normalizes identity without weakening validation", () => {
  assert.equal(normalizeEmail(" Ana@Example.COM "), "ana@example.com");
});

test("register login session and logout form a revocable journey", async () => {
  const auth = createAuthService(repository(), { sessionTtlSeconds: 3600 });
  const registered = await auth.register({
    email: "ana@example.com", displayName: "Ana Souza", password: "senha-segura-2026",
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
    auth.register({ email: "inválido", displayName: "A", password: "curta" }),
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
