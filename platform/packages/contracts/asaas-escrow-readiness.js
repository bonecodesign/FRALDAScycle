import { sellerSettlementReadiness } from "./settlement-readiness.js";

// Dry-run decision only. A live release needs a locked database transaction,
// fresh provider reconciliation and the approved marketplace/escrow contract.
export function asaasEscrowReadiness({ settlement, payment, escrow }, now = Date.now()) {
  const local = sellerSettlementReadiness(settlement ?? {}, now);
  const blockers = [...local.blockers];
  if (!payment || payment.status !== "paid" || payment.provider !== "asaas"
    || !payment.reference || !Number.isSafeInteger(payment.amountCents) || payment.amountCents <= 0) {
    blockers.push("asaas_payment_unreconciled");
  }
  if (payment?.refundPending || payment?.disputePending || payment?.chargebackPending) {
    blockers.push("financial_case_pending");
  }
  const paymentCheckedAt = payment?.reconciledAt == null ? NaN : Date.parse(payment.reconciledAt);
  const escrowCheckedAt = escrow?.reconciledAt == null ? NaN : Date.parse(escrow.reconciledAt);
  if (![paymentCheckedAt, escrowCheckedAt].every(time => Number.isFinite(time) && time <= now && now - time <= 300_000)) {
    blockers.push("provider_reconciliation_stale");
  }
  if (!escrow || escrow.status !== "active" || !escrow.guaranteeId
    || escrow.paymentReference !== payment?.reference) {
    blockers.push("asaas_guarantee_unreconciled");
  }
  const expiresAt = escrow?.expiresAt == null ? NaN : Date.parse(escrow.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) blockers.push("asaas_guarantee_expired_or_unknown");
  return Object.freeze({
    simulatedReleaseEligible: blockers.length === 0,
    blockers: Object.freeze([...new Set(blockers)]),
    payoutAllowed: false,
    confirmedAt: local.confirmedAt,
  });
}
