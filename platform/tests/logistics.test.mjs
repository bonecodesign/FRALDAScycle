import assert from "node:assert/strict";
import test from "node:test";
import { createLogisticsService } from "../apps/api/logistics-service.js";
import { createLogisticsProvider } from "../apps/api/logistics-provider.js";
import { createLogisticsRepository } from "../database/logistics-repository.js";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";

const transactionId = "11111111-1111-4111-8111-111111111111";
const shipmentId = "22222222-2222-4222-8222-222222222222";

test("logistics creates pickup locally and external delivery through provider", async () => {
  const createdInputs = [];
  const repository = {
    async context() { return { existing: false, transaction: { id: transactionId, seller_id: "seller-1", status: "paid" } }; },
    async createShipment(input) {
      createdInputs.push(input);
      return { id: shipmentId, transaction_id: transactionId, mode: input.mode, insured: input.insured, status: input.mode === "pickup" ? "awaiting_pickup" : "provider_pending" };
    },
    async attachProvider(input) {
      return { id: input.shipmentId, transaction_id: transactionId, mode: "partner", insured: true, status: input.status, estimated_delivery_at: input.estimatedDeliveryAt };
    },
  };
  const provider = {
    async createShipment() { return { providerReference: "remote-1", status: "assigned", estimatedDeliveryAt: new Date("2030-01-01") }; },
  };
  const service = createLogisticsService(repository, provider);
  const pickup = await service.create("buyer-1", {
    transactionId, mode: "pickup", insured: false, idempotencyKey: "shipment-pickup-0001",
  });
  assert.equal(pickup.shipment.status, "awaiting_pickup");
  const partner = await service.create("buyer-1", {
    transactionId, mode: "partner", insured: true, idempotencyKey: "shipment-partner-0001",
  });
  assert.equal(partner.shipment.status, "assigned");
  assert.equal(createdInputs[1].sellerId, "seller-1");
});

test("logistics provider uses HTTPS authentication and idempotency", async () => {
  const calls = [];
  const provider = createLogisticsProvider(loadConfig({
    NODE_ENV: "test", LOGISTICS_PROVIDER_URL: "https://logistics.example.test/api",
    LOGISTICS_PROVIDER_SECRET: "logistics-secret",
  }), {
    async fetchImpl(url, options) {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({
        reference: "remote-shipment-1", status: "assigned", estimatedDeliveryAt: "2030-01-01T12:00:00.000Z",
      }), { status: 201, headers: { "content-type": "application/json" } });
    },
  });
  const result = await provider.createShipment({
    shipmentId, transactionId, mode: "partner", insured: true, idempotencyKey: "shipment-provider-0001",
  });
  assert.equal(result.status, "assigned");
  assert.equal(calls[0].options.headers.authorization, "Bearer logistics-secret");
  assert.equal(calls[0].options.headers["idempotency-key"], "shipment-provider-0001");
  assert.equal(JSON.parse(calls[0].options.body).insured, true);
});

test("courier assignment persists event and audit atomically", async () => {
  const statements = [];
  const client = {
    async query(text, values) {
      statements.push({ text, values });
      if (/UPDATE shipments/.test(text)) return { rows: [{ id: shipmentId, courier_id: "courier-1", status: "assigned" }] };
      return { rows: [] };
    },
  };
  const repository = createLogisticsRepository({
    async transaction(operation) { return operation(client); },
    async query() { return { rows: [] }; },
  });
  const assigned = await repository.assignCourier({ shipmentId, courierId: "courier-1" });
  assert.equal(assigned.status, "assigned");
  assert.equal(statements.length, 3);
  assert.match(statements[1].text, /shipment_events/);
  assert.match(statements[2].text, /shipment\.courier\.assigned/);
});

test("delivery proof completes shipment and transaction in one transaction", async () => {
  const statements = [];
  const client = {
    async query(text, values) {
      statements.push({ text, values });
      if (/SELECT id, transaction_id/.test(text)) return { rows: [{ id: shipmentId, transaction_id: transactionId, status: "in_transit" }] };
      if (/INSERT INTO delivery_proofs/.test(text)) return { rows: [{ id: "proof-1", created_at: new Date() }] };
      return { rows: [] };
    },
  };
  const repository = createLogisticsRepository({
    async transaction(operation) { return operation(client); },
    async query() { return { rows: [] }; },
  });
  const proof = await repository.addProof({
    shipmentId, courierId: "courier-1", mediaKey: "proofs/photo.webp",
    recipientName: "Ana Souza", latitude: -19.9, longitude: -43.9,
  });
  assert.equal(proof.id, "proof-1");
  assert.equal(statements.length, 6);
  assert.match(statements[2].text, /status='delivered'/);
  assert.match(statements[3].text, /status='completed'/);
  assert.match(statements[4].text, /shipment_events/);
  assert.match(statements[5].text, /shipment\.proof\.created/);
});

test("logistics HTTP protects shipment reads assignment and proof", async (context) => {
  const users = {
    buyer: { id: "buyer-1", role: "customer" },
    courier: { id: "courier-1", role: "courier" },
  };
  const authService = { async session(token) { return users[token] ?? null; } };
  const logisticsService = {
    async create(userId) { return { shipment: { id: shipmentId, buyerId: userId }, reused: false }; },
    async detail(userId, id) { return { id, userId }; },
    async assign(userId, id) { return { id, courierId: userId }; },
    async proof(userId, id) { return { id: "proof-1", shipmentId: id, courierId: userId }; },
  };
  const server = createApiServer({
    config: loadConfig({ NODE_ENV: "test" }), authService, logisticsService,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(origin + "/v1/shipments/" + shipmentId)).status, 401);
  const detail = await fetch(origin + "/v1/shipments/" + shipmentId, { headers: { cookie: "fc_session=buyer" } });
  assert.equal(detail.status, 200);
  const forbidden = await fetch(origin + "/v1/shipments/" + shipmentId + "/assign", { method: "POST", headers: { cookie: "fc_session=buyer" } });
  assert.equal(forbidden.status, 403);
  const assigned = await fetch(origin + "/v1/shipments/" + shipmentId + "/assign", { method: "POST", headers: { cookie: "fc_session=courier" } });
  assert.equal(assigned.status, 200);
});

test("logistics configuration requires paired HTTPS credentials", () => {
  assert.throws(() => loadConfig({ LOGISTICS_PROVIDER_URL: "https://logistics.example.test" }), /configured together/);
  assert.throws(() => loadConfig({
    LOGISTICS_PROVIDER_URL: "http://logistics.example.test", LOGISTICS_PROVIDER_SECRET: "secret",
  }), /must use HTTPS/);
});
