import assert from "node:assert/strict";
import test from "node:test";
import {
  privacyCommunicationDecision,
  privacyRiskAssessment,
} from "../packages/contracts/privacy-incident.js";

test("privacy assessment stores classification without profile or personal data", () => {
  assert.deepEqual(privacyRiskAssessment({
    likelihood: "medium", impact: "high", affectedScope: "multiple_accounts",
    containsChildData: true, immediateRisk: true, investigationComplete: false,
  }), {
    likelihood: "medium", impact: "high", affectedScope: "multiple_accounts",
    containsChildData: true, immediateRisk: true, investigationComplete: false,
  });
  assert.throws(() => privacyRiskAssessment({
    likelihood: "high", impact: "severe", affectedScope: "single_account",
    containsChildData: true, immediateRisk: true, investigationComplete: false,
    birthDate: "2024-01-01",
  }), error => error.code === "invalid_privacy_risk_assessment");
});

test("communication may be preliminary before completion but final decisions require investigation", () => {
  assert.deepEqual(privacyCommunicationDecision({
    decision: "preliminary_notice_required", channels: ["account", "anpd"],
    investigationComplete: false, legalDeadlineAt: "2026-11-12T12:00:00.000Z",
  }), {
    decision: "preliminary_notice_required", channels: ["account", "anpd"],
    investigationComplete: false, legalDeadlineAt: "2026-11-12T12:00:00.000Z",
    externalDispatchAuthorized: false,
  });
  assert.throws(() => privacyCommunicationDecision({
    decision: "complete_notice_required", channels: ["email"],
    investigationComplete: false, legalDeadlineAt: null,
  }), error => error.code === "privacy_investigation_incomplete");
  assert.throws(() => privacyCommunicationDecision({
    decision: "external_notice_not_required", channels: ["email"],
    investigationComplete: true, legalDeadlineAt: null,
  }), error => error.code === "invalid_privacy_communication_decision");
});
