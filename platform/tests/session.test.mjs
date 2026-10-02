import assert from "node:assert/strict";
import test from "node:test";
import { authenticatedUser } from "../apps/api/session.js";
import { AuthError } from "../apps/api/auth-service.js";

test("protected routes resolve identity from the session cookie", async () => {
  const user = { id: "customer-1", role: "customer" };
  const request = { headers: { cookie: "other=value; fc_session=opaque%20token", authorization: "Bearer ignored" } };
  const authService = {
    async session(token) {
      assert.equal(token, "opaque token");
      return user;
    },
  };
  assert.equal(await authenticatedUser(request, authService), user);
});

test("missing and expired sessions retain the unauthorized contract", async () => {
  for (const cookie of [undefined, "fc_session=expired"]) {
    await assert.rejects(
      authenticatedUser({ headers: { cookie } }, { session: async () => null }),
      error => error instanceof AuthError && error.status === 401
        && error.code === "unauthenticated" && error.message === "Sessão não autenticada.",
    );
  }
});

test("session lookup failures propagate to the existing API error handler", async () => {
  const failure = new Error("identity backend unavailable");
  await assert.rejects(
    authenticatedUser({ headers: {} }, { session: async () => { throw failure; } }),
    error => error === failure,
  );
  await assert.rejects(authenticatedUser({ headers: {} }, null), TypeError);
});
