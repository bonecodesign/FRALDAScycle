export const CONSENT_POLICY_VERSION = "FC-CONSENT-1";

export function normalizeMarketingConsent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some(key => !["enabled", "noticeVersion"].includes(key))
    || typeof input.enabled !== "boolean" || input.noticeVersion !== CONSENT_POLICY_VERSION) {
    throw new Error("invalid_marketing_consent");
  }
  return Object.freeze({
    enabled: input.enabled,
    email: input.enabled,
    sms: input.enabled,
    push: input.enabled,
    noticeVersion: CONSENT_POLICY_VERSION,
  });
}

export function normalizeCookieConsent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some(key => !["analytics", "marketing", "policyVersion"].includes(key))
    || typeof input.analytics !== "boolean" || typeof input.marketing !== "boolean"
    || input.policyVersion !== CONSENT_POLICY_VERSION) {
    throw new Error("invalid_cookie_consent");
  }
  return Object.freeze({
    necessary: true,
    analytics: input.analytics,
    marketing: input.marketing,
    policyVersion: CONSENT_POLICY_VERSION,
  });
}
