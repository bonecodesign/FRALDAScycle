import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { handleManufacturerCatalog } from "../apps/api/manufacturer-catalog-handler.js";

function request(method, path, body = null) {
  const stream = Readable.from(body == null ? [] : [Buffer.from(JSON.stringify(body))]);
  stream.method = method;
  stream.url = path;
  stream.headers = { cookie: "fc_session=valid", ...(body == null ? {} : { "content-type": "application/json" }) };
  return stream;
}

function response() {
  return { status: null, headers: null, body: null,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = JSON.parse(body); } };
}

const dependencies = {
  headers: {}, requestId: "request-1",
  authService: { async session(token) { return token === "valid" ? { id: "admin", role: "admin" } : null; } },
};

test("catalog handler lists, imports and reviews through authenticated service calls", async () => {
  const calls = [];
  const service = {
    async listBatches(actor) { calls.push(["list", actor.id]); return [{ id: "batch-1" }]; },
    async importBatch(actor, input) { calls.push(["import", actor.id, input.manufacturer]); return { id: "batch-2" }; },
    async reviewBatch(actor, id, input) { calls.push(["review", actor.id, id, input.decision]); return { id, status: "active" }; },
  };
  for (const [method, path, body, expected] of [
    ["GET", "/v1/admin/manufacturer-catalog/batches", null, 200],
    ["POST", "/v1/admin/manufacturer-catalog/imports", { manufacturer: "Marca" }, 201],
    ["POST", "/v1/admin/manufacturer-catalog/batches/10000000-0000-4000-8000-000000000064/reviews", { decision: "approve" }, 200],
  ]) {
    const req = request(method, path, body); const res = response();
    assert.equal(await handleManufacturerCatalog(req, res, { ...dependencies, url: new URL(path, "http://local"), manufacturerCatalogService: service }), true);
    assert.equal(res.status, expected);
    assert.equal(res.headers["cache-control"], "no-store");
  }
  assert.deepEqual(calls.map(item => item[0]), ["list", "import", "review"]);
});

test("unrelated routes are ignored without authentication", async () => {
  assert.equal(await handleManufacturerCatalog(request("GET", "/health"), response(), {
    ...dependencies, url: new URL("/health", "http://local"), manufacturerCatalogService: {},
  }), false);
});
