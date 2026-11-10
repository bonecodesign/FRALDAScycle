const likelihoods = new Set(["low", "medium", "high"]);
const impacts = new Set(["low", "medium", "high", "severe"]);
const scopes = new Set(["single_account", "multiple_accounts", "unknown"]);
const decisions = new Set([
  "preliminary_notice_required",
  "complete_notice_required",
  "external_notice_not_required",
]);
const channels = new Set(["account", "email", "anpd"]);

function fail(code) {
  const error = new TypeError(code);
  error.code = code;
  throw error;
}

function exact(value, allowed, code) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(key => !allowed.has(key))) fail(code);
}

export function privacyRiskAssessment(value) {
  exact(value, new Set([
    "likelihood", "impact", "affectedScope", "containsChildData",
    "immediateRisk", "investigationComplete",
  ]), "invalid_privacy_risk_assessment");
  if (!likelihoods.has(value.likelihood) || !impacts.has(value.impact) ||
      !scopes.has(value.affectedScope) || typeof value.containsChildData !== "boolean" ||
      typeof value.immediateRisk !== "boolean" || typeof value.investigationComplete !== "boolean") {
    fail("invalid_privacy_risk_assessment");
  }
  return Object.freeze({
    likelihood: value.likelihood,
    impact: value.impact,
    affectedScope: value.affectedScope,
    containsChildData: value.containsChildData,
    immediateRisk: value.immediateRisk,
    investigationComplete: value.investigationComplete,
  });
}

export function privacyCommunicationDecision(value) {
  exact(value, new Set([
    "decision", "channels", "investigationComplete", "legalDeadlineAt",
  ]), "invalid_privacy_communication_decision");
  if (!decisions.has(value.decision) || !Array.isArray(value.channels) ||
      new Set(value.channels).size !== value.channels.length ||
      value.channels.some(channel => !channels.has(channel)) ||
      typeof value.investigationComplete !== "boolean") fail("invalid_privacy_communication_decision");
  const deadline = value.legalDeadlineAt == null ? null : String(value.legalDeadlineAt);
  if (deadline != null && !Number.isFinite(Date.parse(deadline))) fail("invalid_privacy_communication_decision");
  if (value.decision === "preliminary_notice_required" && value.channels.length === 0) {
    fail("invalid_privacy_communication_decision");
  }
  if (["complete_notice_required", "external_notice_not_required"].includes(value.decision) &&
      value.investigationComplete !== true) fail("privacy_investigation_incomplete");
  if (value.decision === "complete_notice_required" && value.channels.length === 0) {
    fail("invalid_privacy_communication_decision");
  }
  if (value.decision === "external_notice_not_required" && value.channels.length !== 0) {
    fail("invalid_privacy_communication_decision");
  }
  return Object.freeze({
    decision: value.decision,
    channels: Object.freeze([...value.channels]),
    investigationComplete: value.investigationComplete,
    legalDeadlineAt: deadline,
    externalDispatchAuthorized: false,
  });
}
