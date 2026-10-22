import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadConfig } from "../apps/api/config.js";

const handler = await readFile(new URL("../apps/api/courier-eligibility-handler.js", import.meta.url), "utf8");
const server = await readFile(new URL("../apps/api/server.js", import.meta.url), "utf8");

test("courier eligibility routes expose status and support but not raw document submission", () => {
  assert.match(handler, /\/v1\/courier\/eligibility/);
  assert.match(handler, /\/v1\/courier\/eligibility\/support-release/);
  assert.doesNotMatch(handler, /submitClearance\(/);
});

test("restricted admin routes are authenticated and responses are never cacheable", () => {
  assert.match(handler, /courier-clearance\\\/reviews/);
  assert.match(handler, /courier-clearance\\\/suspensions/);
  assert.match(handler, /authenticatedUser/g);
  assert.match(handler, /no-store/g);
  assert.doesNotMatch(handler, /encryption_key_reference|restrictedDocument/);
});

test("API server wires the courier eligibility handler as an optional service", () => {
  assert.match(server, /handleCourierEligibility/);
  assert.match(server, /courierEligibilityService = null/);
});

test("courier eligibility stays disabled until policy configuration and production acknowledgment", () => {
  assert.equal(loadConfig({ NODE_ENV: "test" }).courierEligibilityEnabled, false);
  assert.throws(() => loadConfig({
    NODE_ENV: "test", COURIER_ELIGIBILITY_ENABLED: "true",
  }), /retention policy configuration/);
  const configured = loadConfig({
    NODE_ENV: "test", COURIER_ELIGIBILITY_ENABLED: "true",
    COURIER_CLEARANCE_RETENTION_POLICY_VERSION: "FC-PRIVACY-2026-01",
    COURIER_CLEARANCE_RETENTION_LEGAL_APPROVER_ID: "11111111-1111-4111-8111-111111111111",
  });
  assert.equal(configured.courierEligibilityEnabled, true);
  assert.throws(() => loadConfig({
    NODE_ENV: "production", DATABASE_URL: "postgres://example", SESSION_SECRET: "x".repeat(32),
    NOTIFICATION_WEBHOOK_URL: "https://notifications.example.test",
    NOTIFICATION_WEBHOOK_SECRET: "secret", COURIER_ELIGIBILITY_ENABLED: "true",
  }), /COURIER_ELIGIBILITY_ACTIVATION_ACKNOWLEDGED/);
});
