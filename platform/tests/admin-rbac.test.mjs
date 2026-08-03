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
    async createInvitation(actor, input) { return { invitation: { id: "invite-1", role: input.role, invitedBy: actor.id }, queued: true }; },
    async acceptInvitation() { return { user: { id: "invited-1", role: "courier", emailVerified: true } }; },
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

  const moderatorInvite = await fetch(origin + "/v1/admin/invitations", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "fc_session=moderator" },
    body: JSON.stringify({ displayName: "Nova Pessoa", email: "nova@example.com", role: "courier" }),
  });
  assert.equal(moderatorInvite.status, 403);

  const adminInvite = await fetch(origin + "/v1/admin/invitations", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "fc_session=admin" },
    body: JSON.stringify({ displayName: "Nova Pessoa", email: "nova@example.com", role: "courier" }),
  });
  assert.equal(adminInvite.status, 201);
  assert.equal((await adminInvite.json()).queued, true);

  const accepted = await fetch(origin + "/v1/auth/invitations/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "a".repeat(43), password: "senha-muito-segura" }),
  });
  assert.equal(accepted.status, 201);
  assert.equal((await accepted.json()).user.emailVerified, true);
});

test("user suspension revokes sessions and persists an audit reason atomically", async () => {
  const statements = [];
  const client = {
    async query(text, values) {
      statements.push({ text, values });
      if (/SELECT id, disabled_at/.test(text)) return { rows: [{ id: targetId, disabled_at: null }] };
      if (/UPDATE users/.test(text)) return { rows: [{ id: targetId, disabled_at: new Date() }] };
      return { rows: [] };
    },
  };
  const database = {
    async transaction(operation) { return operation(client); },
    async query() { return { rows: [] }; },
  };
  await createAdminRepository(database).setUserStatus({
    actorUserId: "22222222-2222-4222-8222-222222222222",
    targetUserId: targetId,
    status: "suspended",
    reason: "Revisão preventiva solicitada pela moderação.",
  });
  assert.equal(statements.length, 4);
  assert.match(statements[2].text, /UPDATE sessions SET revoked_at/);
  assert.match(statements[3].text, /INSERT INTO audit_events/);
  assert.match(statements[3].values[3], /Revisão preventiva/);
});

test("audit CSV neutralizes spreadsheet formulas", async () => {
  const service = createAdminService({
    async listAuditEvents() {
      return [{
        occurred_at: "2026-08-03T12:00:00Z", actor_name: "=HYPERLINK(\"bad\")",
        action: "user.suspended", entity_type: "user", entity_id: targetId, metadata: {},
      }];
    },
  });
  const csv = await service.auditCsv();
  assert.match(csv, /"'=HYPERLINK/);
  assert.ok(csv.startsWith("\uFEFF"));
});

test("live user directory, status mutation and CSV export enforce scopes", async (context) => {
  const users = {
    moderator: { id: "moderator-1", role: "moderator" },
    admin: { id: "admin-1", role: "admin" },
  };
  const authService = { async session(token) { return users[token] ?? null; } };
  const adminService = {
    async users() { return [{ id: targetId, display_name: "Ana Souza", role: "customer" }]; },
    async setUserStatus(actor, id, input) { return { id, disabled_at: input.status === "suspended" ? new Date() : null, actor: actor.id }; },
    async auditCsv() { return "\uFEFF\"Data\",\"Ação\"\r\n\"2026-08-03\",\"user.suspended\""; },
  };
  const server = createApiServer({
    config: loadConfig({ NODE_ENV: "test" }), authService, adminService,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  const directory = await fetch(`${origin}/v1/admin/users`, { headers: { cookie: "fc_session=moderator" } });
  assert.equal(directory.status, 200);
  assert.equal((await directory.json()).items.length, 1);

  const denied = await fetch(`${origin}/v1/admin/users/${targetId}/status`, {
    method: "PATCH", headers: { "content-type": "application/json", cookie: "fc_session=moderator" },
    body: JSON.stringify({ status: "suspended", reason: "Revisão preventiva necessária." }),
  });
  assert.equal(denied.status, 403);

  const suspended = await fetch(`${origin}/v1/admin/users/${targetId}/status`, {
    method: "PATCH", headers: { "content-type": "application/json", cookie: "fc_session=admin" },
    body: JSON.stringify({ status: "suspended", reason: "Revisão preventiva necessária." }),
  });
  assert.equal(suspended.status, 200);

  const exported = await fetch(`${origin}/v1/admin/audit-events.csv`, {
    headers: { cookie: "fc_session=moderator" },
  });
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get("content-type"), /text\/csv/);
  assert.match(exported.headers.get("content-disposition"), /fraldacycle-auditoria\.csv/);
});

test("revoking other sessions preserves the current session and audits the count", async () => {
  const statements = [];
  const client = {
    async query(text, values) {
      statements.push({ text, values });
      if (/UPDATE sessions/.test(text)) return { rows: [{ id: "old-session" }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
  };
  const database = {
    async transaction(operation) { return operation(client); },
    async query() { return { rows: [] }; },
  };
  const count = await createAdminRepository(database).revokeOtherSessions({
    actorUserId: "22222222-2222-4222-8222-222222222222",
    currentSessionId: "33333333-3333-4333-8333-333333333333",
  });
  assert.equal(count, 1);
  assert.match(statements[0].text, /id <> \$2::uuid/);
  assert.match(statements[1].text, /sessions\.others\.revoked/);
  assert.match(statements[1].values[1], /revokedCount/);
});

test("session management endpoints preserve current access and require admin scope", async (context) => {
  const identities = {
    moderator: { id: "moderator-1", role: "moderator", sessionId: "33333333-3333-4333-8333-333333333333" },
    admin: { id: "admin-1", role: "admin", sessionId: "33333333-3333-4333-8333-333333333333" },
  };
  const authService = { async session(token) { return identities[token] ?? null; } };
  const adminService = {
    async sessions(actor) { return [{ id: actor.sessionId, current: true }]; },
    async revokeOtherSessions() { return { revokedCount: 2 }; },
  };
  const server = createApiServer({
    config: loadConfig({ NODE_ENV: "test" }), authService, adminService,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  const denied = await fetch(`${origin}/v1/admin/sessions`, {
    headers: { cookie: "fc_session=moderator" },
  });
  assert.equal(denied.status, 403);

  const listed = await fetch(`${origin}/v1/admin/sessions`, {
    headers: { cookie: "fc_session=admin" },
  });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).items[0].current, true);

  const revoked = await fetch(`${origin}/v1/admin/sessions/revoke-others`, {
    method: "POST", headers: { cookie: "fc_session=admin" },
  });
  assert.equal(revoked.status, 200);
  assert.equal((await revoked.json()).revokedCount, 2);
});


test("administrative invitations persist only the token hash and queue delivery atomically", async () => {
  const statements = [];
  const invitationId = "33333333-3333-4333-8333-333333333333";
  const client = {
    async query(text, values) {
      statements.push({ text, values });
      if (/SELECT id FROM users/.test(text)) return { rows: [] };
      if (/INSERT INTO admin_invitations/.test(text)) {
        return { rows: [{ id: invitationId, email: "nova@example.com", role: "courier" }] };
      }
      return { rows: [] };
    },
  };
  const repository = createAdminRepository({
    async transaction(operation) { return operation(client); },
    async query() { return { rows: [] }; },
  });
  const token = "raw-secret-token";
  const invitation = await repository.createInvitation({
    actorUserId: "22222222-2222-4222-8222-222222222222",
    email: "nova@example.com",
    displayName: "Nova Pessoa",
    role: "courier",
    tokenHash: Buffer.from("hash"),
    token,
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
  });

  assert.equal(invitation.id, invitationId);
  assert.equal(statements.length, 5);
  assert.match(statements[2].text, /INSERT INTO admin_invitations/);
  assert.equal(statements[2].values.includes(token), false);
  assert.match(statements[3].text, /notification_outbox/);
  assert.match(statements[3].values[1], /raw-secret-token/);
  assert.match(statements[4].text, /admin\.invitation\.created/);
});

test("invitation acceptance is single-use, creates a verified account and records audit", async () => {
  const statements = [];
  const client = {
    async query(text, values) {
      statements.push({ text, values });
      if (/UPDATE admin_invitations/.test(text)) {
        return { rows: [{
          id: "invite-1", email: "nova@example.com", display_name: "Nova Pessoa",
          role: "courier", invited_by: "admin-1",
        }] };
      }
      if (/INSERT INTO users/.test(text)) {
        return { rows: [{
          id: "user-1", email: "nova@example.com", display_name: "Nova Pessoa",
          role: "courier", email_verified_at: new Date(),
        }] };
      }
      return { rows: [] };
    },
  };
  const repository = createAdminRepository({
    async transaction(operation) { return operation(client); },
    async query() { return { rows: [] }; },
  });
  const user = await repository.acceptInvitation({
    tokenHash: Buffer.from("hash"),
    passwordHash: "protected-password",
  });

  assert.equal(user.role, "courier");
  assert.equal(statements.length, 3);
  assert.match(statements[0].text, /consumed_at IS NULL AND expires_at > now\(\)/);
  assert.match(statements[1].text, /email_verified_at/);
  assert.match(statements[2].text, /admin\.invitation\.accepted/);
});
