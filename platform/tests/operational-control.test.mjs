import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { createOperationalControlService, controlledDomain } from "../apps/api/operational-control.js";
import { createOperationalControlRepository } from "../database/operational-control-repository.js";
import { handleAdmin } from "../apps/api/admin-handler.js";

const admin = { id: "11111111-1111-4111-8111-111111111111", role: "admin" };

test("operational control targets only creation of new commitments", () => {
  const id = "22222222-2222-4222-8222-222222222222";
  assert.equal(controlledDomain("POST", "/v1/listings"), "marketplace");
  assert.equal(controlledDomain("POST", `/v1/listings/${id}/transactions`), "marketplace");
  assert.equal(controlledDomain("POST", "/v1/exchanges"), "marketplace");
  assert.equal(controlledDomain("POST", `/v1/exchanges/${id}/accept`), "marketplace");
  assert.equal(controlledDomain("POST", "/v1/payments/intents"), "payments");
  assert.equal(controlledDomain("POST", `/v1/payments/${id}/refunds`), null);
  assert.equal(controlledDomain("POST", `/v1/shipments/${id}/assign`), "logistics");
  assert.equal(controlledDomain("POST", `/v1/shipments/${id}/proof`), null);
  assert.equal(controlledDomain("POST", "/v1/support/tickets"), null);
  assert.equal(controlledDomain("POST", "/v1/privacy/requests"), null);
});

test("pause and resume require explicit confirmation and an auditable reason", async () => {
  const changes = [];
  const service = createOperationalControlService({
    async change(input) { changes.push(input); return { ...input, version: 2 }; },
    async list() { return []; }, async blocked() { return null; },
  });
  await assert.rejects(service.change(admin, { domain: "global", action: "pause", reason: "Risco operacional confirmado.", confirmed: false }), error => error.code === "operational_confirmation_required");
  await assert.rejects(service.change(admin, { domain: "global", action: "pause", reason: "curto", confirmed: true }), error => error.code === "invalid_operational_reason");
  const result = await service.change(admin, { domain: "logistics", action: "pause", reason: "Indisponibilidade logística preventiva.", confirmed: true });
  assert.equal(result.state.paused, true);
  assert.equal(changes[0].actorUserId, admin.id);
});

test("global or domain pause fails closed without blocking safe continuations", async () => {
  const service = createOperationalControlService({
    async list() { return []; }, async change() {}, async blocked(domain) { return domain === "payments" ? { domain: "global" } : null; },
  });
  await assert.rejects(service.assertAvailable("payments"), error => error.code === "operational_paused" && error.status === 503);
  await service.assertAvailable("marketplace");
});

test("repository changes state and audit in the same transaction", async () => {
  const statements = [];
  const client = { async query(text, values) {
    statements.push({ text, values });
    if (/SELECT domain/.test(text)) return { rows: [{ domain: "global", paused: false, version: 1 }] };
    if (/UPDATE operational_controls/.test(text)) return { rows: [{ domain: "global", paused: true, reason: values[2], version: 2 }] };
    return { rows: [] };
  } };
  const database = { async transaction(operation) { return operation(client); }, async query() { return { rows: [] }; } };
  const state = await createOperationalControlRepository(database).change({ actorUserId: admin.id, domain: "global", paused: true, reason: "Manutenção preventiva aprovada." });
  assert.equal(state.version, 2);
  assert.equal(statements.length, 3);
  assert.match(statements[0].text, /FOR UPDATE/);
  assert.match(statements[2].text, /INSERT INTO audit_events/);
  assert.match(statements[2].values[3], /previousVersion/);
});

test("admin operations exposes an accessible audited pause and resume control", async () => {
  const [html, controller] = await Promise.all([
    readFile(new URL("../apps/admin/operations.html", import.meta.url), "utf8"),
    readFile(new URL("../apps/admin/operational-control.js", import.meta.url), "utf8"),
  ]);
  assert.match(html, /aria-labelledby="operational-control-title"/);
  assert.match(html, /name="domain"/);
  assert.match(html, /name="action"/);
  assert.match(html, /name="reason"[^>]*minlength="10"[^>]*required/);
  assert.match(html, /name="confirmed"[^>]*required/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /\/apps\/admin\/operational-control\.js/);
  assert.match(controller, /\/v1\/admin\/operational-control/);
  assert.match(controller, /confirmed: form\.elements\.confirmed\.checked/);
});

test("admin handler exposes status and change while enforcing role", async () => {
  const users = { admin, customer: { id: "customer-1", role: "customer" } };
  const authService = { async session(token) { return users[token] ?? null; } };
  let paused = true;
  const operationalControlService = {
    async status() { return { items: [{ domain: "global", paused }] }; },
    async change(actor, input) { paused = input.action === "pause"; return { state: { domain: input.domain, paused, changedBy: actor.id } }; },
  };
  const response = () => ({ status: 0, headers: {}, body: "", writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } });
  const call = async ({ method = "GET", token, body }) => {
    const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
    request.method = method;
    request.headers = { cookie: `fc_session=${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) };
    const output = response();
    const handled = await handleAdmin(request, output, {
      url: new URL("http://localhost/v1/admin/operational-control"), headers: {}, requestId: "test-request",
      authService, adminService: null, realtimeService: null, operationalControlService,
    });
    return { handled, output, payload: output.body ? JSON.parse(output.body) : null };
  };
  await assert.rejects(call({ token: "customer" }), error => error.code === "forbidden");
  const status = await call({ token: "admin" });
  assert.equal(status.handled, true);
  assert.equal(status.output.status, 200);
  assert.equal(status.payload.items[0].paused, true);
  assert.equal(status.output.headers["cache-control"], "no-store");
  const changed = await call({ method: "PUT", token: "admin", body: { domain: "global", action: "resume", reason: "Retomada operacional confirmada.", confirmed: true } });
  assert.equal(changed.output.status, 200);
  assert.equal(changed.payload.state.paused, false);
  assert.equal(changed.payload.state.changedBy, admin.id);
});
