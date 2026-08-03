import assert from "node:assert/strict";
import test from "node:test";
import { createPaymentService } from "../apps/api/payment-service.js";
import { createPaymentProvider } from "../apps/api/payment-provider.js";
import { createPaymentRepository } from "../database/payment-repository.js";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";

const transactionId = "11111111-1111-4111-8111-111111111111";

function paymentStore(kind = "sale", amountCents = 10_000) {
  let sequence = 0;
  return {
    async context() {
      return { existing: false, transaction: {
        id: transactionId, buyer_id: "buyer-1", status: "reserved", kind, amount_cents: amountCents,
      } };
    },
    async createIntent(input) {
      sequence += 1;
      return {
        id: "22222222-2222-4222-8222-222222222222",
        transaction_id: input.transactionId, method: input.method,
        amount_cents: input.amountCents, platform_fee_cents: input.platformFeeCents,
        delivery_fee_cents: input.deliveryFeeCents, seller_amount_cents: input.sellerAmountCents,
        status: "provider_pending", checkout_payload: {},
      };
    },
    async attachProvider(input) {
      return {
        id: input.intentId, transaction_id: transactionId, method: "pix",
        amount_cents: amountCents,
        platform_fee_cents: kind === "sale" ? 800 : kind === "exchange" ? 500 : 0,
        delivery_fee_cents: 500,
        seller_amount_cents: amountCents - (kind === "sale" ? 800 : kind === "exchange" ? 500 : 0) - 500,
        status: input.status, checkout_payload: input.checkoutPayload,
      };
    },
    async markProviderFailure() {},
    get sequence() { return sequence; },
  };
}

const provider = {
  async createIntent() {
    return { providerReference: "provider-1", status: "pending", checkout: { qrCode: "safe-code" } };
  },
};

test("payment service enforces approved sale exchange donation and delivery splits", async () => {
  for (const [kind, platformFee] of [["sale", 800], ["exchange", 500], ["donation", 0]]) {
    const store = paymentStore(kind);
    const service = createPaymentService(store, provider);
    const result = await service.createIntent("buyer-1", {
      transactionId, idempotencyKey: `payment-${kind}-0001`, method: "pix", deliveryRequested: true,
    });
    assert.equal(result.intent.platformFeeCents, platformFee);
    assert.equal(result.intent.deliveryFeeCents, 500);
    assert.equal(result.intent.sellerAmountCents, 10_000 - platformFee - 500);
    assert.equal(
      result.intent.platformFeeCents + result.intent.deliveryFeeCents + result.intent.sellerAmountCents,
      result.intent.amountCents,
    );
  }
});

test("payment service refuses raw card data and requires provider tokenization", async () => {
  const service = createPaymentService(paymentStore(), provider);
  await assert.rejects(service.createIntent("buyer-1", {
    transactionId, idempotencyKey: "payment-card-raw-0001", method: "credit",
    cardNumber: "4111111111111111", cvv: "123",
  }), (error) => error.code === "raw_card_data_forbidden");
  await assert.rejects(service.createIntent("buyer-1", {
    transactionId, idempotencyKey: "payment-card-token-0001", method: "credit",
  }), (error) => error.code === "payment_token_required");
});

test("payment provider sends idempotent BRL intent and exact split without exposing credentials", async () => {
  const calls = [];
  const adapter = createPaymentProvider(loadConfig({
    NODE_ENV: "test",
    PAYMENT_PROVIDER_URL: "https://payments.example.test/api",
    PAYMENT_PROVIDER_SECRET: "payment-secret",
  }), {
    async fetchImpl(url, options) {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({
        reference: "remote-123", status: "pending", qrCode: "pix-code",
      }), { status: 201, headers: { "content-type": "application/json" } });
    },
  });
  const result = await adapter.createIntent({
    id: "intent-1", idempotencyKey: "payment-provider-0001", method: "pix",
    amountCents: 10_000, platformFeeCents: 800, deliveryFeeCents: 500, sellerAmountCents: 8_700,
  });
  assert.equal(result.providerReference, "remote-123");
  assert.equal(calls[0].options.headers.authorization, "Bearer payment-secret");
  assert.equal(calls[0].options.headers["idempotency-key"], "payment-provider-0001");
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.currency, "BRL");
  assert.deepEqual(payload.split, { platformCents: 800, deliveryCents: 500, sellerCents: 8_700 });
  assert.equal(payload.secret, undefined);
});

test("payment persistence updates transaction and audit atomically", async () => {
  const statements = [];
  const client = {
    async query(text, values) {
      statements.push({ text, values });
      if (/INSERT INTO payment_intents/.test(text)) return { rows: [{ id: "intent-1" }] };
      return { rows: [] };
    },
  };
  const repository = createPaymentRepository({
    async transaction(operation) { return operation(client); },
    async query() { return { rows: [] }; },
  });
  await repository.createIntent({
    transactionId, buyerId: "buyer-1", idempotencyKey: "payment-repository-0001",
    method: "pix", amountCents: 10_000, platformFeeCents: 800,
    deliveryFeeCents: 500, sellerAmountCents: 8_700,
  });
  assert.equal(statements.length, 3);
  assert.match(statements[0].text, /INSERT INTO payment_intents/);
  assert.match(statements[1].text, /status = 'payment_pending'/);
  assert.match(statements[2].text, /payment\.intent\.created/);
});

test("payment HTTP endpoint requires an authenticated buyer", async (context) => {
  const authService = { async session(token) { return token === "buyer" ? { id: "buyer-1" } : null; } };
  const paymentService = {
    async createIntent(buyerId) {
      return { intent: { id: "intent-1", buyerId }, reused: false };
    },
  };
  const server = createApiServer({
    config: loadConfig({ NODE_ENV: "test" }), authService, paymentService,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  const denied = await fetch(origin + "/v1/payments/intents", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  });
  assert.equal(denied.status, 401);
  const created = await fetch(origin + "/v1/payments/intents", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "fc_session=buyer" },
    body: JSON.stringify({ transactionId }),
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).intent.buyerId, "buyer-1");
});

test("payment configuration requires paired HTTPS credentials", () => {
  assert.throws(() => loadConfig({ PAYMENT_PROVIDER_URL: "https://payments.example.test" }), /configured together/);
  assert.throws(() => loadConfig({
    PAYMENT_PROVIDER_URL: "http://payments.example.test", PAYMENT_PROVIDER_SECRET: "secret",
  }), /must use HTTPS/);
});
