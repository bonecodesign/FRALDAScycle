export const PILOT_ID = /^[a-z][a-z0-9-]*$/;

// Seven official gates of the isolated pilot readiness manifest.
// A partial or duplicated set cannot justify an internal go decision.
export const PILOT_GATES = Object.freeze([
  "product-rules",
  "identity-access",
  "marketplace-journey",
  "safety-privacy",
  "accessibility-devices",
  "support-incidents",
  "pilot-exit",
]);

export function isDateString(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
