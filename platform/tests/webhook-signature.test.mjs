import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createPaymentProvider } from "../apps/api/payment-provider.js";
import { createLogisticsProvider } from "../apps/api/logistics-provider.js";

const secret = "synthetic-webhook-test-key";
const now = () => Date.parse("2026-10-02T12:00:00Z");
const seconds = now() / 1000;
const providers = [
  [createPaymentProvider({ paymentWebhookSecret: secret }), "payment.paid", "invalid_webhook_"],
  [createLogisticsProvider({ logisticsWebhookSecret: secret }), "shipment.delivered", "invalid_logistics_webhook_"],
];
const payload = type => Buffer.from(JSON.stringify({ id: "event-test", type, createdAt: new Date(now()).toISOString(), data: { reference: "reference-test", amountCents: 500 } }));
const signature = (raw, timestamp) => "v1=" + createHmac("sha256", secret).update(`${timestamp}.`).update(raw).digest("hex");

test("both webhook adapters accept signed requests at the exact replay-window boundaries", () => {
  for (const [provider, type] of providers) {
    const raw = payload(type);
    for (const timestamp of [seconds - 300, seconds, seconds + 300]) {
      assert.equal(provider.verifyWebhook({ raw, timestamp, signature: signature(raw, timestamp), now }).id, "event-test");
    }
  }
});

test("both webhook adapters reject stale timestamps and tampered signatures with their original error codes", () => {
  for (const [provider, type, prefix] of providers) {
    const raw = payload(type);
    for (const timestamp of [seconds - 301, seconds + 301, "invalid"]) {
      assert.throws(() => provider.verifyWebhook({ raw, timestamp, signature: "invalid", now }), error => error.status === 401 && error.code === prefix + "timestamp");
    }
    for (const received of [undefined, "short", "v1=" + "0".repeat(64)]) {
      assert.throws(() => provider.verifyWebhook({ raw, timestamp: seconds, signature: received, now }), error => error.status === 401 && error.code === prefix + "signature");
    }
    const changed = Buffer.concat([raw, Buffer.from(" ")]);
    assert.throws(() => provider.verifyWebhook({ raw: changed, timestamp: seconds, signature: signature(raw, seconds), now }), error => error.status === 401 && error.code === prefix + "signature");
  }
});
