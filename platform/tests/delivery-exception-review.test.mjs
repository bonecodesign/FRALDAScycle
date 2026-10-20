import assert from "node:assert/strict";
import test from "node:test";
import { deliveryExceptionReview } from "../packages/contracts/delivery-exception-review.js";

test("every delivery exception remains with support and blocks payout", () => {
  for (const reason of ["cancelled", "recipient_absent", "proof_contested", "delivery_failed"]) {
    const result = deliveryExceptionReview({ reason, supportTicket: { id: "ticket-1", status: "under_review" } });
    assert.equal(result.status, "under_support_review");
    assert.equal(result.supportRequired, true);
    assert.equal(result.autoCloseAllowed, false);
    assert.equal(result.payoutAllowed, false);
  }
});

test("missing or closed support review cannot silently close exception", () => {
  for (const supportTicket of [null, { id: "ticket-1", status: "resolved" }]) {
    const result = deliveryExceptionReview({ reason: "proof_contested", supportTicket });
    assert.equal(result.status, "awaiting_support_review");
    assert.ok(result.blockers.includes("support_review_required"));
  }
});
