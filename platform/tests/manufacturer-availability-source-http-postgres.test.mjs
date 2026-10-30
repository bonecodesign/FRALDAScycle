import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { handleManufacturerCatalog } from "../apps/api/manufacturer-catalog-handler.js";
import { createManufacturerAvailabilitySourceRepository } from "../database/manufacturer-availability-source-repository.js";

const sourceId = "10000000-0000-4000-8000-000000000001";
function request(method, path, body) {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  stream.method = method; stream.url = path; stream.headers = { cookie: "fc_session=valid", "content-type": "application/json" };
  return stream;
}
function response() { return { status: null, headers: null, body: null, writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = JSON.parse(body); } }; }
const dependencies = { headers: {}, requestId: "request-1", authService: { async session(token) { return token === "valid" ? { id: "admin", role: "admin" } : null; } } };

test("source governance endpoints expose authenticated HTTP workflow", async () => {
  const calls = [];
  const sourceService = {
    async list(actor) { calls.push(["list", actor.id]); return { sources: [{ id: sourceId, review_status: "pending" }], candidates: [] }; },
    async create(actor, input) { calls.push(["create", actor.id, input.origin]); return { id: sourceId, ...input }; },
    async decide(actor, id, input) { calls.push(["decide", actor.id, id, input.decision]); return { id, review_status: "approved" }; },
    async activate(actor, id, input) { calls.push(["activate", actor.id, id, input.enabled]); return { id, refresh_enabled: input.enabled }; },
  };
  const catalogService = {};
  const routes = [
    ["GET", "/v1/admin/manufacturer-catalog/sources", undefined, 200],
    ["POST", "/v1/admin/manufacturer-catalog/sources", { sourceUrl: "https://shop.example/stock", origin: "manual" }, 201],
    ["POST", `/v1/admin/manufacturer-catalog/sources/${sourceId}/decision`, { decision: "approve", reason: "Fonte revisada e pertinente.", confirmed: true }, 200],
    ["POST", `/v1/admin/manufacturer-catalog/sources/${sourceId}/activation`, { enabled: true }, 200],
  ];
  for (const [method, path, body, expectedStatus] of routes) {
    const result = response();
    assert.equal(await handleManufacturerCatalog(request(method, path, body), result, { ...dependencies, url: new URL(path, "http://local"), manufacturerCatalogService: catalogService, manufacturerAvailabilitySourceService: sourceService }), true);
    assert.equal(result.status, expectedStatus);
    assert.equal(result.headers["cache-control"], "no-store");
  }
  assert.deepEqual(calls.map(call => call[0]), ["list", "create", "decide", "activate"]);
});

test("postgres repository only activates approved sources and audits mutations", async () => {
  const statements = [];
  const database = {
    async query(sql, values) { statements.push({ sql, values }); return { rows: [{ id: sourceId, review_status: "pending", approved: false }] }; },
    async transaction(operation) { return operation({ async query(sql, values) { statements.push({ sql, values }); return { rows: [{ id: sourceId, review_status: "approved", approved: true, refresh_enabled: true }] }; } }); },
  };
  const repository = createManufacturerAvailabilitySourceRepository(database);
  const created = await repository.create({ actorId: "admin", sourceUrl: "https://shop.example", origin: "manual" });
  assert.equal(created.id, sourceId);
  await repository.decide({ actorId: "admin", id: sourceId, decision: "approved", reason: "Conferida." });
  await repository.activate({ actorId: "admin", id: sourceId, enabled: true });
  assert.ok(statements.some(({ sql }) => /approved=true AND review_status='approved'/.test(sql)));
  assert.ok(statements.filter(({ sql }) => /INSERT INTO audit_events/.test(sql)).length >= 2);
});

test("candidate review and promotion routes remain separate", async () => {
  const calls = [];
  const service = { async decideCandidate(actor, id, input) { calls.push(["decide", actor.id, id, input.decision]); return { id, review_status: input.decision }; }, async promoteCandidate(actor, id) { calls.push(["promote", actor.id, id]); return { id, origin: "discovered", refresh_enabled: false }; } };
  for (const [path, body, status] of [[`/v1/admin/manufacturer-catalog/source-candidates/${sourceId}/decision`, { decision: "approved", reason: "Revisada.", confirmed: true }, 200], [`/v1/admin/manufacturer-catalog/source-candidates/${sourceId}/promote`, {}, 201]]) {
    const result = response();
    assert.equal(await handleManufacturerCatalog(request("POST", path, body), result, { ...dependencies, url: new URL(path, "http://local"), manufacturerCatalogService: {}, manufacturerAvailabilitySourceService: service }), true);
    assert.equal(result.status, status);
  }
  assert.deepEqual(calls.map(call => call[0]), ["decide", "promote"]);
});
