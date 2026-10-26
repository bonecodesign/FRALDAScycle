const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const NAVIGATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const ENGAGEMENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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
