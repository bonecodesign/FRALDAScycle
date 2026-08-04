import assert from "node:assert/strict";
import test from "node:test";
import { inspectProductionReadiness } from "../tools/production-doctor.mjs";

const complete = {
  DATABASE_URL: "postgresql://db.internal/fraldacycle",
  SESSION_SECRET: "s".repeat(48),
  NOTIFICATION_WEBHOOK_URL: "https://notify.vendor.dev/v1",
  NOTIFICATION_WEBHOOK_SECRET: "notify-secret",
  MEDIA_PROVIDER_URL: "https://media.vendor.dev/v1",
  MEDIA_PROVIDER_SECRET: "media-secret",
  GEOCODING_PROVIDER_URL: "https://geo.vendor.dev/v1",
  GEOCODING_PROVIDER_SECRET: "geo-secret",
  PAYMENT_PROVIDER_URL: "https://pay.vendor.dev/v1",
  PAYMENT_PROVIDER_SECRET: "payment-secret",
  PAYMENT_WEBHOOK_SECRET: "payment-hook-secret",
  PAYMENT_PROVIDER_SDK_URL: "https://pay.vendor.dev/sdk.js",
  PAYMENT_PROVIDER_SDK_INTEGRITY: "sha384-valid-integrity",
  LOGISTICS_PROVIDER_URL: "https://logistics.vendor.dev/v1",
  LOGISTICS_PROVIDER_SECRET: "logistics-secret",
  LOGISTICS_WEBHOOK_SECRET: "logistics-hook-secret",
  RATE_LIMIT_PROVIDER_URL: "https://limits.vendor.dev/v1",
  RATE_LIMIT_PROVIDER_SECRET: "limits-secret",
  TELEMETRY_PROVIDER_URL: "https://telemetry.vendor.dev/v1",
  TELEMETRY_PROVIDER_SECRET: "telemetry-secret",
  SECRETS_PROVIDER_URL: "https://vault.vendor.dev/v1",
  SECRETS_PROVIDER_TOKEN: "vault-token",
  SECRETS_PROVIDER_KEYS: "DATABASE_URL,SESSION_SECRET",
};

test("production doctor approves a complete provider contract", () => {
  const report = inspectProductionReadiness(complete);
  assert.equal(report.ready, true);
  assert.deepEqual(report.blockers, []);
});

test("production doctor reports missing bundles without exposing secrets", () => {
  const report = inspectProductionReadiness({
    ...complete,
    PAYMENT_PROVIDER_SECRET: "replace-with-payment-provider-secret",
    LOGISTICS_WEBHOOK_SECRET: "",
  });
  assert.equal(report.ready, false);
  assert.deepEqual(report.integrations.payments.missing, ["PAYMENT_PROVIDER_SECRET"]);
  assert.deepEqual(report.integrations.logistics.missing, ["LOGISTICS_WEBHOOK_SECRET"]);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes("notify-secret"), false);
  assert.equal(serialized.includes("vault-token"), false);
});
