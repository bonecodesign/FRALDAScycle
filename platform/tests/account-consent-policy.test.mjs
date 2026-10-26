import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCookieConsent, normalizeMarketingConsent } from "../packages/contracts/account-consent-policy.js";
import { marketingDataRetention, marketingDispatchDecision } from "../packages/contracts/marketing-dispatch-policy.js";

test("marketing consent is one optional all-or-nothing choice", () => {
  assert.deepEqual(normalizeMarketingConsent({ enabled: true, noticeVersion: "FC-CONSENT-1" }), {
    enabled: true, email: true, sms: true, push: true, noticeVersion: "FC-CONSENT-1",
  });
  assert.deepEqual(normalizeMarketingConsent({ enabled: false, noticeVersion: "FC-CONSENT-1" }), {
    enabled: false, email: false, sms: false, push: false, noticeVersion: "FC-CONSENT-1",
  });
  assert.throws(() => normalizeMarketingConsent({ email: true, sms: false, push: false }), /invalid_marketing/);
});

test("necessary cookies cannot be disabled and optional choices remain independent", () => {
  assert.deepEqual(normalizeCookieConsent({ analytics: true, marketing: false, policyVersion: "FC-CONSENT-1" }), {
    necessary: true, analytics: true, marketing: false, policyVersion: "FC-CONSENT-1",
  });
  assert.throws(() => normalizeCookieConsent({ necessary: false, analytics: false, marketing: false, policyVersion: "FC-CONSENT-1" }), /invalid_cookie/);
});

test("promotional delivery requires consent and enforces monthly frequency", () => {
  const now = Date.parse("2030-03-15T00:00:00Z");
  const consent = { enabled: true, noticeVersion: "FC-CONSENT-1" };
  assert.equal(marketingDispatchDecision({ consent, now }).allowed, true);
  assert.deepEqual(marketingDispatchDecision({ consent, lastSentAt: "2030-03-01T00:00:00Z", now }).blockers, ["monthly_frequency_limit"]);
  assert.deepEqual(marketingDispatchDecision({ consent: { enabled: false, noticeVersion: "FC-CONSENT-1" }, now }).blockers, ["marketing_consent_missing"]);
});

test("navigation and engagement data expire after their approved windows", () => {
  const now = Date.parse("2030-04-01T00:00:00Z");
  assert.equal(marketingDataRetention({ kind: "navigation", occurredAt: "2030-01-02T00:00:00Z", now }).retain, true);
  assert.equal(marketingDataRetention({ kind: "navigation", occurredAt: "2029-12-31T23:59:59Z", now }).retain, false);
  assert.equal(marketingDataRetention({ kind: "email_click", occurredAt: "2030-03-02T00:00:00Z", now }).retain, true);
  assert.equal(marketingDataRetention({ kind: "email_open", occurredAt: "2030-03-01T23:59:59Z", now }).retain, false);
});
