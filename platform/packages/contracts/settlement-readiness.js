// Informational snapshot only. Recheck atomically before any future external payout.
export function sellerSettlementReadiness(row, now = Date.now()) {
  const blockers = [];
  if (row.kind !== "sale") blockers.push("unsupported_transaction_kind");
  if (row.shipment_status !== "delivered" || !row.id) blockers.push("delivery_proof_pending");
  if (row.transaction_status !== "in_delivery") blockers.push("transaction_not_eligible");
  if (row.paid_count !== 1 || row.payment_blocked !== false) blockers.push("payment_not_confirmed");
  if (row.financial_case_pending !== false) blockers.push("financial_case_pending");
  const approval = row.approved_at == null ? NaN : new Date(row.approved_at).getTime();
  const validation = row.validated_at == null ? NaN : new Date(row.validated_at).getTime();
  if (!Number.isFinite(approval) || approval > now) blockers.push("receiver_approval_pending");
  if (!Number.isFinite(validation) || validation > now) blockers.push("proof_validation_pending");
  const datesValid = Number.isFinite(approval) && approval <= now && Number.isFinite(validation) && validation <= now;
  const confirmedAt = datesValid ? Math.max(approval, validation) : null;
  const targetDeadline = confirmedAt === null ? null : confirmedAt + 3 * 24 * 60 * 60 * 1000;
  return {
    requirementsMet: blockers.length === 0, blockers,
    confirmedAt: confirmedAt === null ? null : new Date(confirmedAt).toISOString(),
    targetDeadline: targetDeadline === null ? null : new Date(targetDeadline).toISOString(),
    targetOverdue: targetDeadline !== null && now > targetDeadline,
    deadlineStatus: "provider_confirmation_pending",
    payoutAllowed: false, payoutStatus: "not_configured",
  };
}
