import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";
import { createPilotInvitationService } from "../apps/api/pilot-invitation-service.js";

const token = "b".repeat(43);

test("pilot invitation HTTP routes enforce RBAC and expose a token only on first issue", async context => {
  const users = {
    customer: { id: "11111111-1111-4111-8111-111111111111", role: "customer" },
    moderator: { id: "22222222-2222-4222-8222-222222222222", role: "moderator" },
    admin: { id: "33333333-3333-4333-8333-333333333333", role: "admin" },
  };
  let issued = false;
  const repository = {
    async list({ limit }) { return [{ id: "invite-1", limit }]; },
    async issue(input) {
      const reused = issued; issued = true;
      return { invitation: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: input.email }, reused };
    },
  };
  const server = createApiServer({
    config: loadConfig({ NODE_ENV: "test", RATE_LIMIT_MAX: "1000" }),
    authService: { async session(value) { return users[value] ?? null; } },
    pilotInvitationService: createPilotInvitationService(repository, {
      clock: () => Date.parse("2030-01-01T12:00:00Z"), tokenFactory: () => token,
    }),
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const body = JSON.stringify({
    email: "piloto@example.test", purpose: "Acesso sintético controlado ao piloto BH.",
    expiresAt: "2030-01-08T12:00:00Z", requestReference: "pilot-invite-http-0001",
  });

  const denied = await fetch(`${origin}/v1/admin/pilot-invitations`, {
    method: "POST", headers: { "content-type": "application/json", cookie: "fc_session=moderator" }, body,
  });
  assert.equal(denied.status, 403);

  const created = await fetch(`${origin}/v1/admin/pilot-invitations`, {
    method: "POST", headers: { "content-type": "application/json", cookie: "fc_session=admin" }, body,
  });
  assert.equal(created.status, 201);
  assert.equal(created.headers.get("cache-control"), "no-store");
  assert.deepEqual(await created.json().then(value => ({ token: value.token, delivered: value.delivered })), {
    token, delivered: false,
  });

  const replay = await fetch(`${origin}/v1/admin/pilot-invitations`, {
    method: "POST", headers: { "content-type": "application/json", cookie: "fc_session=admin" }, body,
  });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).token, null);

  const listed = await fetch(`${origin}/v1/admin/pilot-invitations?limit=10`, {
    headers: { cookie: "fc_session=moderator" },
  });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).items[0].limit, 10);

  const customerList = await fetch(`${origin}/v1/admin/pilot-invitations`, {
    headers: { cookie: "fc_session=customer" },
  });
  assert.equal(customerList.status, 403);
});
