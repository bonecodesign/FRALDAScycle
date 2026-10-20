import assert from "node:assert/strict";
import test from "node:test";
import { parseAsaasWebhook } from "../apps/api/asaas-webhook.js";

const raw = Buffer.from(JSON.stringify({ id: "evt-1", event: "PAYMENT_RECEIVED", payment: { id: "pay-1" } }));

test("Asaas webhook accepts only the configured access token and a valid event shape", () => {
  assert.deepEqual(parseAsaasWebhook({ raw, accessToken: "secret-123" }, "secret-123"),
    { id: "evt-1", event: "PAYMENT_RECEIVED", paymentId: "pay-1" });
  assert.throws(() => parseAsaasWebhook({ raw, accessToken: "wrong" }, "secret-123"), /authentication failed/);
  assert.throws(() => parseAsaasWebhook({ raw: Buffer.from("{}"), accessToken: "secret-123" }, "secret-123"), /Invalid Asaas/);
});
