import assert from "node:assert/strict";
import test from "node:test";
import { hasScope, requireScope } from "../apps/api/authorization.js";
import { createAdminService } from "../apps/api/admin-service.js";
import { createAdminRepository } from "../database/admin-repository.js";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";

const targetId = "11111111-1111-4111-8111-111111111111";

test("RBAC grants only scopes assigned to each approved role", () => {
  assert.equal(hasScope({ role: "customer" }, "marketplace:use"), true);
  assert.equal(hasScope({ role: "customer" }, "admin:audit:read"), false);
  assert.equal(hasScope({ role: "moderator" }, "admin:audit:read"), true);
  assert.equal(hasScope({ role: "moderator" }, "admin:roles:write"), false);
  assert.equal(hasScope({ role: "admin" }, "admin:roles:write"), true);
  assert.throws(() => requireScope({ role: "customer" }, "admin:audit:read"), (error) => error.code === "forbidden");
});

test("admin service validates roles and prevents accidental self-demotion", async () => {
  const service = createAdminService({
    async changeUserRole(input) { return input; },
    async listAuditEvents() { return []; },
  });
  await assert.rejects(
    service.changeUserRole({ id: "admin-1" }, targetId, { role: "owner" }),
    (error) => error.code === "invalid_role",
  );
  await assert.rejects(
    service.changeUserRole({ id: targetId }, targetId, { role: "customer" }),
    (error) => error.code === "self_demotion_forbidden",
  );
});

test("role changes and audit records share one database transaction", async () => {
  const statements = [];
  const client = {
    async query(text, values) {
      statements.push({ text, values });
      if (/SELECT id, role/.test(text)) return { rows: [{ id: targetId, role: "customer" }] };
      if (/UPDATE users/.test(text)) return { rows: [{ id: targetId, role: "moderator" }] };
      return { rows: [] };
    },
  };
  const database = {
    async transaction(operation) { return operation(client); },
    async query() { return { rows: [] }; },
  };
  const changed = await createAdminRepository(database).changeUserRole({
    actorUserId: "22222222-2222-4222-8222-222222222222",
    targetUserId: targetId,
    role: "moderator",
  });
  assert.equal(changed.role, "moderator");
  assert.equal(statements.length, 3);
  assert.match(statements[2].text, /INSERT INTO audit_events/);
  assert.match(statements[2].values[2], /previousRole/);
});

test("admin HTTP endpoints enforce moderator and administrator boundaries", async (context) => {
  const users = {
    customer: { id: "customer-1", role: "customer" },
    moderator: { id: "moderator-1", role: "moderator" },
    admin: { id: "admin-1", role: "admin" },
  };
  const authService = { async session(token) { return users[token] ?? null; } };
  const adminService = {
    async auditEvents() { return [{ id: 1, action: "user.role.changed" }]; },
    async changeUserRole(actor, id, input) { return { id, role: input.role, actor: actor.id }; },
  };
  const server = createApiServer({
    config: loadConfig({ NODE_ENV: "test" }), authService, adminService,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  const customerAudit = await fetch(`${origin}/v1/admin/audit-events`, {
    headers: { cookie: "fc_session=customer" },
  });
  assert.equal(customerAudit.status, 403);

  const moderatorAudit = await fetch(`${origin}/v1/admin/audit-events`, {
    headers: { cookie: "fc_session=moderator" },
  });
  assert.equal(moderatorAudit.status, 200);

  const moderatorChange = await fetch(`${origin}/v1/admin/users/${targetId}/role`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: "fc_session=moderator" },
    body: JSON.stringify({ role: "courier" }),
  });
  assert.equal(moderatorChange.status, 403);

  const adminChange = await fetch(`${origin}/v1/admin/users/${targetId}/role`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: "fc_session=admin" },
    body: JSON.stringify({ role: "courier" }),
  });
  assert.equal(adminChange.status, 200);
  assert.equal((await adminChange.json()).user.role, "courier");
});
