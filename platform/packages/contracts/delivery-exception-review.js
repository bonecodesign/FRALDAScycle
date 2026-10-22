const REVIEW_REASONS = new Set(["cancelled", "recipient_absent", "proof_contested", "delivery_failed"]);

// No provider status or elapsed time may complete a disputed operation.
export function deliveryExceptionReview({ reason, supportTicket, paymentDisputed = false }) {
  const blockers = [];
  if (!REVIEW_REASONS.has(reason)) blockers.push("unknown_delivery_exception");
  if (!supportTicket?.id || supportTicket.status === "resolved") blockers.push("support_review_required");
  if (paymentDisputed) blockers.push("payment_disputed");
  return Object.freeze({
    supportRequired: true,
    status: blockers.length === 0 ? "under_support_review" : "awaiting_support_review",
    blockers: Object.freeze(blockers),
    autoCloseAllowed: false,
    payoutAllowed: false,
  });
}

export function deliveryExceptionFinancialReview({
  responsibility,
  providerFeeCents,
  providerEvidence,
  supportDecisionConfirmed = false,
}) {
  const blockers = [];
  if (!["provider", "user", "unresolved"].includes(responsibility)) blockers.push("invalid_responsibility");
  if (!Number.isSafeInteger(providerFeeCents) || providerFeeCents < 0) blockers.push("invalid_provider_fee");
  if (!providerEvidence?.reference || providerEvidence.charged !== (providerFeeCents > 0)) {
    blockers.push("provider_fee_evidence_required");
  }
  if (!supportDecisionConfirmed) blockers.push("support_decision_required");
  if (responsibility === "unresolved") blockers.push("responsibility_unresolved");

  const ready = blockers.length === 0;
  return Object.freeze({
    ready,
    automaticDeductionAllowed: false,
    outcome: !ready ? "under_support_review" : responsibility === "provider" ? "refund_payer" : "charge_user_provider_fee_only",
    chargeableUserCents: ready && responsibility === "user" ? providerFeeCents : 0,
    refundRequired: ready && responsibility === "provider",
    blockers: Object.freeze(blockers),
  });
}
