import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCookieConsent, normalizeMarketingConsent } from "../packages/contracts/account-consent-policy.js";
import {
  externalMarketingDeliveryPayload,
  FAMILY_MARKETING_NOTICE_VERSION,
  internalFamilyMarketingEligibility,
  marketingDataRetention,
  marketingDispatchDecision,
} from "../packages/contracts/marketing-dispatch-policy.js";

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

test("family age bands may select an internal campaign only with specific consent", () => {
  const consent = { enabled: true, noticeVersion: FAMILY_MARKETING_NOTICE_VERSION };
  assert.deepEqual(internalFamilyMarketingEligibility({ consent, ageBands: ["infant_6_11", "infant_6_11", "child_36_plus"] }), {
    eligible: true, scope: "internal_family_age_band",
    ageBands: ["infant_6_11", "child_36_plus"], externalSharingAllowed: false,
  });
  assert.throws(() => internalFamilyMarketingEligibility({
    consent: { enabled: true, noticeVersion: "FC-CONSENT-1" }, ageBands: ["infant_6_11"],
  }), error => error.code === "family_marketing_consent_missing");
});

test("external marketing delivery fails closed on child profile or derived age data", () => {
  const consent = { enabled: true, noticeVersion: FAMILY_MARKETING_NOTICE_VERSION };
  const base = { consent, campaignId: "monthly-family-01", channel: "email", recipient: "adult@example.test", templateId: "family-monthly-v1" };
  assert.deepEqual(externalMarketingDeliveryPayload({ ...base, metadata: { locale: "pt-BR" } }), {
    campaignId: "monthly-family-01", channel: "email", recipient: "adult@example.test",
    templateId: "family-monthly-v1", metadata: { locale: "pt-BR" },
  });
  for (const metadata of [
    { birthDate: "2024-01-01" }, { emoji: "🍼" },
    { profileId: "00000000-0000-0000-0000-000000000001" },
    { segmentation: { ageBand: "infant_6_11" } },
    { profiles: [{ child_profile_id: "00000000-0000-0000-0000-000000000001" }] },
  ]) assert.throws(() => externalMarketingDeliveryPayload({ ...base, metadata }),
    error => error.code === "child_profile_data_forbidden_in_marketing_delivery");
});


test("PRIV-06: marketing boundary rejects child-field aliases in nested metadata", () => {
  const consent = { enabled: true, noticeVersion: FAMILY_MARKETING_NOTICE_VERSION };
  const base = {
    consent, campaignId: "family-privacy-synthetic", channel: "email",
    recipient: "adult@example.test", templateId: "privacy-template-v1",
  };
  const aliases = [
    "date_of_birth", "Birth-Date", "dateOfBirth", "BIRTHDATE", "DOB",
    "child_dob", "child_birth_date", "babyBirthDate", "child-id",
    "child_profile_id", "childProfileIds", "child-profiles",
    "AGE_BAND", "age-bands", "ChildAgeBand", "child_age",
    "profile_id", "ProfileID", "family_profile", "childEmoji",
    "faixa_etaria", "Faixa Etária", "Data_Nascimento",
    "dataDeNascimento", "idade_criança", "perfil-infantil", "ID_CRIANÇA",
  ];
  for (const alias of aliases) {
    const metadata = {
      locale: "pt-BR", categories: [{ marketing: { audience: { [alias]: "synthetic-rejected" } } }],
    };
    assert.throws(
      () => externalMarketingDeliveryPayload({ ...base, metadata }),
      error => error.code === "child_profile_data_forbidden_in_marketing_delivery" &&
        error.path.endsWith("." + alias),
      `metadata must reject alias ${alias}`,
    );
  }
  const accepted = {
    locale: "pt-BR", campaignContext: [{ color: "green", tags: ["weekly", "general"] }],
    audienceType: "adults", messageCategory: "promotional",
  };
  assert.deepEqual(externalMarketingDeliveryPayload({ ...base, metadata: accepted }).metadata, accepted);
});

test("PRIV-06: cyclic, class-backed and overdeep metadata fail without external delivery", () => {
  const base = {
    consent: { enabled: true, noticeVersion: FAMILY_MARKETING_NOTICE_VERSION },
    campaignId: "family-privacy-synthetic", channel: "email",
    recipient: "adult@example.test", templateId: "privacy-template-v1",
  };
  const self = { locale: "pt-BR" }; self.loop = self;
  const arr = []; arr.push(arr);
  let deep = { locale: "pt-BR" };
  for (let i = 0; i < 36; i++) deep = { wrapper: deep };
  for (const metadata of [
    self, { nested: arr }, { birthday: new Date("2026-01-01") },
    { detail: new Map([["birthDate", "synthetic"]]) }, { detail: new Date("2026-01-01") },
    deep,
  ]) {
    assert.throws(
      () => externalMarketingDeliveryPayload({ ...base, metadata }),
      error => error.code === "invalid_marketing_delivery" ||
        error.code === "child_profile_data_forbidden_in_marketing_delivery",
    );
  }
  // The same plain metadata referenced in two branches is not a cycle.
  const common = { locale: "pt-BR" };
  const shared = { header: common, footer: common };
  assert.deepEqual(externalMarketingDeliveryPayload({ ...base, metadata: shared }).metadata, shared);
});
