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
