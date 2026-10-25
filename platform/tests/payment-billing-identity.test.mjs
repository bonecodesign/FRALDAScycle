import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createPaymentService } from "../apps/api/payment-service.js";
import { createPaymentProvider } from "../apps/api/payment-provider.js";
import { loadConfig } from "../apps/api/config.js";
import { verifyBillingCpf } from "../packages/contracts/payment-billing-identity.js";

const secret = "billing-cpf-hmac-secret-for-tests-0001";
const cpf = "52998224725";
const fingerprint = createHmac("sha256", secret).update(cpf).digest();
const transactionId = "11111111-1111-4111-8111-111111111111";

test("CPF de cobrança é normalizado e comparado à impressão da conta", () => {
  assert.equal(verifyBillingCpf("529.982.247-25", fingerprint, secret), cpf);
  assert.throws(() => verifyBillingCpf("111.444.777-35", fingerprint, secret),
    error => error.code === "billing_cpf_mismatch" && error.status === 422);
  assert.throws(() => verifyBillingCpf(cpf, fingerprint, "short"),
    error => error.code === "billing_identity_not_configured" && error.status === 503);
});

function repository(storedFingerprint = fingerprint) {
  return {
    async billingIdentity() { return storedFingerprint ? { cpf_fingerprint: storedFingerprint } : null; },
    async context() { return { existing: false, transaction: { id: transactionId, buyer_id: "buyer-1",
      status: "initiated", kind: "sale", amount_cents: 10_000 } }; },
    async createIntent(input) { return { id: "22222222-2222-4222-8222-222222222222",
      transaction_id: input.transactionId, method: input.method, amount_cents: input.amountCents,
      platform_fee_cents: input.platformFeeCents, delivery_fee_cents: input.deliveryFeeCents,
      seller_amount_cents: input.sellerAmountCents, status: "provider_pending", checkout_payload: {} }; },
    async attachProvider(input) { return { id: input.intentId, transaction_id: transactionId, method: "credit",
      amount_cents: 10_000, platform_fee_cents: 800, delivery_fee_cents: 0, seller_amount_cents: 9_200,
      status: input.status, checkout_payload: input.checkoutPayload }; },
    async markProviderFailure() {},
  };
}

test("cartão exige CPF cadastrado correspondente e envia a identidade somente ao provedor", async () => {
  let remote;
  const provider = { async createIntent(input) { remote = input; return {
    providerReference: "provider-1", status: "pending", checkout: {},
  }; } };
  const service = createPaymentService(repository(), provider, { cpfHmacSecret: secret });
  const result = await service.createIntent("buyer-1", { transactionId,
    idempotencyKey: "billing-identity-card-0001", method: "credit",
    paymentMethodToken: "provider-token", billingCpf: "529.982.247-25" });
  assert.equal(result.intent.status, "pending");
  assert.equal(remote.billingCpf, cpf);
  assert.equal("billingCpf" in result.intent, false);

  await assert.rejects(service.createIntent("buyer-1", { transactionId,
    idempotencyKey: "billing-identity-card-0002", method: "credit",
    paymentMethodToken: "provider-token", billingCpf: "111.444.777-35" }),
  error => error.code === "billing_cpf_mismatch");
  await assert.rejects(createPaymentService(repository(null), provider, { cpfHmacSecret: secret }).createIntent("buyer-1", {
    transactionId, idempotencyKey: "billing-identity-card-0003", method: "credit",
    paymentMethodToken: "provider-token", billingCpf: cpf,
  }), error => error.code === "billing_identity_unavailable");
});

test("API recusa qualquer campo bruto de cartão e campos inesperados", async () => {
  const service = createPaymentService(repository(), { async createIntent() { assert.fail("provider não deve ser chamado"); } },
    { cpfHmacSecret: secret });
  for (const field of ["cardNumber", "cvv", "pan", "securityCode", "expiry", "expires"]) {
    await assert.rejects(service.createIntent("buyer-1", { transactionId,
      idempotencyKey: `raw-field-${field}-0001`, method: "credit", paymentMethodToken: "token",
      billingCpf: cpf, [field]: "" }), error => error.code === "raw_card_data_forbidden");
  }
  await assert.rejects(service.createIntent("buyer-1", { transactionId,
    idempotencyKey: "unexpected-payment-field-0001", method: "pix", note: "não permitido" }),
  error => error.code === "invalid_payment_payload");
});

test("adaptador envia CPF apenas em cartão e não o devolve no checkout", async () => {
  const calls = [];
  const provider = createPaymentProvider(loadConfig({ NODE_ENV: "test",
    PAYMENT_PROVIDER_URL: "https://payments.example.test/api", PAYMENT_PROVIDER_SECRET: "secret" }), {
    async fetchImpl(_url, options) { calls.push(JSON.parse(options.body)); return new Response(JSON.stringify({
      reference: "remote", status: "pending",
    }), { status: 201, headers: { "content-type": "application/json" } }); },
  });
  const base = { id: "intent", idempotencyKey: "provider-billing-identity", amountCents: 10_000,
    platformFeeCents: 800, deliveryFeeCents: 0, sellerAmountCents: 9_200 };
  const result = await provider.createIntent({ ...base, method: "credit", paymentMethodToken: "token", billingCpf: cpf });
  assert.deepEqual(calls[0].customer, { taxId: cpf });
  assert.equal(JSON.stringify(result).includes(cpf), false);
  await provider.createIntent({ ...base, idempotencyKey: "provider-pix-identity", method: "pix" });
  assert.equal(calls[1].customer, undefined);
});
