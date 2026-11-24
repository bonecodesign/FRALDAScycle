const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const NAVIGATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const ENGAGEMENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const FAMILY_MARKETING_NOTICE_VERSION = "FC-FAMILY-MARKETING-1";

// Normalize known variants before the external-provider boundary: camelCase,
// snake_case, kebab-case, upper-case and Portuguese/English field aliases.
// This is not a classifier for opaque free-text values.
const CHILD_PROFILE_KEYS = new Set([
  "ageband", "agebands", "childage", "childageband", "childagebands",
  "birthdate", "birthday", "dateofbirth", "dob", "childbirthdate", "childdob",
  "babybirthdate", "babyid", "childid", "childprofileid", "childprofileids",
  "childprofile", "childprofiles", "emoji", "childemoji", "familyprofile",
  "familyprofiles", "profileid", "profileids", "datanascimento",
  "datadenascimento", "faixaetaria", "idadecrianca", "perfilinfantil",
  "idcrianca",
]);
const normalizedKey = key => key.normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

function instant(value) {
  const timestamp = value == null ? NaN : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function marketingDispatchDecision({ consent, lastSentAt = null, now = Date.now() }) {
  const blockers = [];
  if (!consent || consent.enabled !== true || consent.noticeVersion !== "FC-CONSENT-1") blockers.push("marketing_consent_missing");
  const previous = instant(lastSentAt);
  if (previous != null && (previous > now || now - previous < MONTH_MS)) blockers.push("monthly_frequency_limit");
  return Object.freeze({ allowed: blockers.length === 0, blockers: Object.freeze(blockers) });
}

export function marketingDataRetention({ kind, occurredAt, now = Date.now() }) {
  const occurred = instant(occurredAt);
  if (occurred == null || occurred > now) return Object.freeze({ retain: false, reason: "invalid_timestamp" });
  const maximum = kind === "navigation" ? NAVIGATION_RETENTION_MS
    : ["email_open", "email_click"].includes(kind) ? ENGAGEMENT_RETENTION_MS : null;
  if (maximum == null) return Object.freeze({ retain: false, reason: "unsupported_marketing_data" });
  return Object.freeze({ retain: now - occurred <= maximum, reason: now - occurred <= maximum ? null : "retention_expired" });
}

function assertFamilyMarketingConsent(consent) {
  if (!consent || consent.enabled !== true || consent.noticeVersion !== FAMILY_MARKETING_NOTICE_VERSION) {
    const error = new Error("family_marketing_consent_missing");
    error.code = "family_marketing_consent_missing";
    throw error;
  }
}

function invalidMetadata() {
  const error = new Error("invalid_marketing_delivery");
  error.code = "invalid_marketing_delivery";
  throw error;
}
function assertNoChildProfileData(value, path = "payload", ancestors = new WeakSet(), depth = 0) {
  if (value == null || typeof value !== "object") return;
  // External JSON payloads must not contain cycles, class instances (e.g.
  // Date or Map) or unbounded nesting which bypass object-key inspection.
  if (depth > 32 || ancestors.has(value) ||
      (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null)) invalidMetadata();
  ancestors.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoChildProfileData(item, `${path}[${index}]`, ancestors, depth + 1));
  } else {
    for (const [key, nested] of Object.entries(value)) {
      if (CHILD_PROFILE_KEYS.has(normalizedKey(key))) {
        const error = new Error("child_profile_data_forbidden_in_marketing_delivery");
        error.code = "child_profile_data_forbidden_in_marketing_delivery";
        error.path = `${path}.${key}`;
        throw error;
      }
      assertNoChildProfileData(nested, `${path}.${key}`, ancestors, depth + 1);
    }
  }
  ancestors.delete(value);
}

export function internalFamilyMarketingEligibility({ consent, ageBands }) {
  assertFamilyMarketingConsent(consent);
  if (!Array.isArray(ageBands) || ageBands.length === 0 ||
      ageBands.some(value => typeof value !== "string" || !value.trim())) {
    const error = new Error("invalid_internal_family_age_bands");
    error.code = "invalid_internal_family_age_bands";
    throw error;
  }
  return Object.freeze({
    eligible: true,
    scope: "internal_family_age_band",
    ageBands: Object.freeze([...new Set(ageBands)]),
    externalSharingAllowed: false,
  });
}

export function externalMarketingDeliveryPayload({ consent, campaignId, channel, recipient, templateId, metadata = {} }) {
  assertFamilyMarketingConsent(consent);
  if (!/^[a-z0-9][a-z0-9._:-]{2,79}$/i.test(String(campaignId ?? "")) ||
      !["email", "push"].includes(channel) || typeof recipient !== "string" || !recipient.trim() ||
      !/^[a-z0-9][a-z0-9._:-]{2,79}$/i.test(String(templateId ?? "")) ||
      metadata == null || Array.isArray(metadata) || typeof metadata !== "object") {
    const error = new Error("invalid_marketing_delivery");
    error.code = "invalid_marketing_delivery";
    throw error;
  }
  assertNoChildProfileData(metadata);
  return Object.freeze({
    campaignId: String(campaignId), channel, recipient: recipient.trim(),
    templateId: String(templateId), metadata: Object.freeze({ ...metadata }),
  });
}
