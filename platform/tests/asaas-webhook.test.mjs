import assert from "node:assert/strict";
import test from "node:test";
import { classifyAsaasWebhook, parseAsaasWebhook } from "../apps/api/asaas-webhook.js";

const raw = Buffer.from(JSON.stringify({ id: "evt-1", event: "PAYMENT_RECEIVED", payment: { id: "pay-1" } }));

test("Asaas webhook accepts only the configured access token and a valid event shape", () => {
  assert.deepEqual(parseAsaasWebhook({ raw, accessToken: "secret-123" }, "secret-123"),
    { id: "evt-1", event: "PAYMENT_RECEIVED", paymentId: "pay-1" });
  assert.throws(() => parseAsaasWebhook({ raw, accessToken: "wrong" }, "secret-123"), /authentication failed/);
  assert.throws(() => parseAsaasWebhook({ raw: Buffer.from("{}"), accessToken: "secret-123" }, "secret-123"), /Invalid Asaas/);
});

test("Asaas webhook remains only a candidate until provider reconciliation", () => {
  const event = parseAsaasWebhook({ raw, accessToken: "secret-123" }, "secret-123");
  assert.deepEqual(classifyAsaasWebhook(event), {
    eventId: "evt-1", paymentId: "pay-1", candidate: "payment_receipt_candidate",
    requiresReconciliation: true, financialTransitionAllowed: false,
  });
  assert.deepEqual(classifyAsaasWebhook({ id: "evt-2", event: "UNKNOWN", paymentId: "pay-2" }), {
    eventId: "evt-2", paymentId: "pay-2", candidate: "unsupported_event",
    requiresReconciliation: true, financialTransitionAllowed: false,
  });
});
