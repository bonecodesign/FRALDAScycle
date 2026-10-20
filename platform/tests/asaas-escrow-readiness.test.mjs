import assert from "node:assert/strict";
import test from "node:test";
import { asaasEscrowReadiness } from "../packages/contracts/asaas-escrow-readiness.js";

const now = Date.parse("2030-01-10T12:00:00Z");
const ready = {
  settlement: { id: "proof-1", kind: "sale", shipment_status: "delivered", transaction_status: "in_delivery",
    paid_count: 1, payment_blocked: false, financial_case_pending: false,
    approved_at: "2030-01-10T10:00:00Z", validated_at: "2030-01-10T11:00:00Z" },
  payment: { provider: "asaas", status: "paid", reference: "pay-1", amountCents: 10000, reconciledAt: "2030-01-10T11:59:00Z" },
  escrow: { status: "active", guaranteeId: "guarantee-1", paymentReference: "pay-1", expiresAt: "2030-01-12T00:00:00Z", reconciledAt: "2030-01-10T11:59:00Z" },
};

test("simulated escrow decision requires complete evidence but never enables transfer", () => {
  const result = asaasEscrowReadiness(ready, now);
  assert.equal(result.simulatedReleaseEligible, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.payoutAllowed, false);
});

test("duplicate charge, dispute, refund, missing proof and expired guarantee fail closed", () => {
  const scenarios = [
    [{ settlement: { ...ready.settlement, paid_count: 2 } }, "payment_not_confirmed"],
    [{ settlement: { ...ready.settlement, approved_at: null } }, "receiver_approval_pending"],
    [{ settlement: { ...ready.settlement, validated_at: null } }, "proof_validation_pending"],
    [{ payment: { ...ready.payment, status: "disputed", disputePending: true } }, "asaas_payment_unreconciled"],
    [{ payment: { ...ready.payment, status: "refunded", refundPending: true } }, "asaas_payment_unreconciled"],
    [{ escrow: { ...ready.escrow, paymentReference: "other" } }, "asaas_guarantee_unreconciled"],
    [{ escrow: { ...ready.escrow, expiresAt: "2030-01-10T12:00:00Z" } }, "asaas_guarantee_expired_or_unknown"],
    [{ escrow: { ...ready.escrow, reconciledAt: "2030-01-10T11:54:00Z" } }, "provider_reconciliation_stale"],
  ];
  for (const [patch, expected] of scenarios) {
    const result = asaasEscrowReadiness({ ...ready, ...patch }, now);
    assert.equal(result.simulatedReleaseEligible, false);
    assert.equal(result.payoutAllowed, false);
    assert.ok(result.blockers.includes(expected), expected);
  }
});
