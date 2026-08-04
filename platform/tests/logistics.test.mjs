import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
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


test("logistics webhook verifies HMAC and rejects tampering and stale replay", () => {
  const secret="logistics-webhook-secret";
  const provider=createLogisticsProvider(loadConfig({NODE_ENV:"test",LOGISTICS_WEBHOOK_SECRET:secret}));
  const value={id:"log-evt-1",type:"shipment.in_transit",createdAt:"2030-01-01T00:00:00.000Z",data:{reference:"remote-1",latitude:-19.9,longitude:-43.9,description:"Em trânsito"}};
  const raw=Buffer.from(JSON.stringify(value));const timestamp=1_893_456_000;
  const signature=createHmac("sha256",secret).update(`${timestamp}.`).update(raw).digest("hex");
  const event=provider.verifyWebhook({raw,timestamp:String(timestamp),signature:`v1=${signature}`,now:()=>timestamp*1000});
  assert.equal(event.type,"shipment.in_transit");assert.equal(event.latitude,-19.9);
  assert.throws(()=>provider.verifyWebhook({raw:Buffer.from(JSON.stringify({...value,type:"shipment.delivered"})),timestamp:String(timestamp),signature:`v1=${signature}`,now:()=>timestamp*1000}),(error)=>error.code==="invalid_logistics_webhook_signature");
  assert.throws(()=>provider.verifyWebhook({raw,timestamp:String(timestamp),signature:`v1=${signature}`,now:()=>(timestamp+301)*1000}),(error)=>error.code==="invalid_logistics_webhook_timestamp");
});

test("logistics webhook updates timeline transaction and audit atomically", async () => {
  const statements=[];const client={async query(text,values){statements.push({text,values});if(/INSERT INTO logistics_webhook_events/.test(text))return{rows:[{id:"evt-1"}]};if(/SELECT id,transaction_id,status/.test(text))return{rows:[{id:shipmentId,transaction_id:transactionId,status:"assigned"}]};return{rows:[]}}};
  const repository=createLogisticsRepository({async transaction(operation){return operation(client)},async query(){return{rows:[]}}});
  const result=await repository.processWebhook({id:"evt-1",type:"shipment.in_transit",providerReference:"remote-1",latitude:-19.9,longitude:-43.9,description:"Em trânsito",occurredAt:new Date(),payloadHash:Buffer.from("hash")});
  assert.equal(result.status,"in_transit");assert.equal(statements.length,6);
  assert.match(statements[2].text,/UPDATE shipments/);assert.deepEqual(statements[2].values,[shipmentId,"in_transit"]);
  assert.match(statements[3].text,/UPDATE transactions/);assert.deepEqual(statements[3].values,[transactionId,"in_delivery"]);
  assert.match(statements[4].text,/shipment_events/);assert.match(statements[5].text,/shipment\.webhook\.processed/);
});

test("logistics webhook blocks status regression and duplicate side effects", async () => {
  let calls=0;const client={async query(text){calls+=1;if(/INSERT INTO logistics_webhook_events/.test(text))return{rows:[{id:"evt-regression"}]};if(/SELECT id,transaction_id,status/.test(text))return{rows:[{id:shipmentId,transaction_id:transactionId,status:"in_transit"}]};return{rows:[]}}};
  const repository=createLogisticsRepository({async transaction(operation){return operation(client)},async query(){return{rows:[]}}});
  const ignored=await repository.processWebhook({id:"evt-regression",type:"shipment.assigned",providerReference:"remote-1",occurredAt:new Date(),payloadHash:Buffer.from("hash")});
  assert.deepEqual(ignored,{ignored:true,status:"in_transit"});assert.equal(calls,2);
  let duplicateCalls=0;const duplicateRepository=createLogisticsRepository({async transaction(operation){return operation({async query(){duplicateCalls+=1;return{rows:[]}}})},async query(){return{rows:[]}}});
  assert.deepEqual(await duplicateRepository.processWebhook({id:"same",type:"shipment.in_transit"}),{duplicate:true});assert.equal(duplicateCalls,1);
});

test("signed logistics webhook endpoint requires provider verification", async (context) => {
  const logisticsService={async processWebhook(event){return{accepted:true,duplicate:false,status:event.type}}};
  const logisticsProvider={verifyWebhook({timestamp,signature}){if(!timestamp||signature!=="valid"){const error=new Error("invalid");error.code="invalid_logistics_webhook_signature";error.status=401;throw error}return{type:"shipment.in_transit"}}};
  const server=createApiServer({config:loadConfig({NODE_ENV:"test"}),logisticsService,logisticsProvider});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));context.after(()=>server.close());
  const origin=`http://127.0.0.1:${server.address().port}`;const body=JSON.stringify({id:"evt-http"});
  assert.equal((await fetch(origin+"/v1/logistics/webhooks",{method:"POST",headers:{"content-type":"application/json"},body})).status,401);
  const accepted=await fetch(origin+"/v1/logistics/webhooks",{method:"POST",headers:{"content-type":"application/json","x-logistics-timestamp":"123","x-logistics-signature":"valid"},body});
  assert.equal(accepted.status,200);assert.equal((await accepted.json()).accepted,true);
});
