import assert from "node:assert/strict";
import test from "node:test";
import { deliveryExceptionFinancialReview, deliveryExceptionReview } from "../packages/contracts/delivery-exception-review.js";

test("every delivery exception remains with support and blocks payout", () => {
  for (const reason of ["cancelled", "recipient_absent", "proof_contested", "delivery_failed"]) {
    const result = deliveryExceptionReview({ reason, supportTicket: { id: "ticket-1", status: "under_review" } });
    assert.equal(result.status, "under_support_review");
    assert.equal(result.supportRequired, true);
    assert.equal(result.autoCloseAllowed, false);
    assert.equal(result.payoutAllowed, false);
  }
});

test("provider failure refunds the payer only after evidence and a support decision", () => {
  const result = deliveryExceptionFinancialReview({
    responsibility: "provider", providerFeeCents: 0,
    providerEvidence: { reference: "provider-case-1", charged: false }, supportDecisionConfirmed: true,
  });
  assert.equal(result.ready, true);
  assert.equal(result.outcome, "refund_payer");
  assert.equal(result.refundRequired, true);
  assert.equal(result.chargeableUserCents, 0);
  assert.equal(result.automaticDeductionAllowed, false);
});

test("user-caused cancellation passes through only a proven provider fee", () => {
  const approved = deliveryExceptionFinancialReview({
    responsibility: "user", providerFeeCents: 750,
    providerEvidence: { reference: "provider-case-2", charged: true }, supportDecisionConfirmed: true,
  });
  assert.equal(approved.ready, true);
  assert.equal(approved.outcome, "charge_user_provider_fee_only");
  assert.equal(approved.chargeableUserCents, 750);

  for (const input of [
    { ...approved, responsibility: "unresolved", providerFeeCents: 750, providerEvidence: { reference: "case", charged: true }, supportDecisionConfirmed: true },
    { responsibility: "user", providerFeeCents: 750, providerEvidence: null, supportDecisionConfirmed: true },
    { responsibility: "user", providerFeeCents: 750, providerEvidence: { reference: "case", charged: true }, supportDecisionConfirmed: false },
  ]) {
    const result = deliveryExceptionFinancialReview(input);
    assert.equal(result.ready, false);
    assert.equal(result.outcome, "under_support_review");
    assert.equal(result.chargeableUserCents, 0);
  }
});

test("missing or closed support review cannot silently close exception", () => {
  for (const supportTicket of [null, { id: "ticket-1", status: "resolved" }]) {
    const result = deliveryExceptionReview({ reason: "proof_contested", supportTicket });
    assert.equal(result.status, "awaiting_support_review");
    assert.ok(result.blockers.includes("support_review_required"));
  }
});
