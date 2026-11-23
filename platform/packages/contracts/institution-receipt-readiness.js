// Donation receipts never produce a courier payout. The readiness response
// must fail closed even when a projection is incomplete or malformed.
function evidenceTime(value) {
  if (typeof value !== 'string' && !(value instanceof Date)) return NaN;
  return new Date(value).getTime();
}

export function institutionReceiptReadiness(row, now = Date.now()) {
  const blockers = [];
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    blockers.push('institution_receipt_evidence_unavailable');
    row = {};
  }
  const referenceTime = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(referenceTime)) blockers.push('receipt_clock_unavailable');
  if (row.kind !== 'donation') blockers.push('unsupported_transaction_kind');
  if (row.donation_authorized !== true) blockers.push('institution_authority_pending');
  if (row.shipment_status !== 'delivered' || !row.id) blockers.push('delivery_proof_pending');
  if (row.transaction_status !== 'in_delivery') blockers.push('transaction_not_eligible');

  const approval = evidenceTime(row.approved_at);
  const validation = evidenceTime(row.validated_at);
  if (!Number.isFinite(approval) || (Number.isFinite(referenceTime) && approval > referenceTime)) {
    blockers.push('institution_approval_pending');
  }
  if (!Number.isFinite(validation) || (Number.isFinite(referenceTime) && validation > referenceTime)) {
    blockers.push('independent_proof_validation_pending');
  }
  if (Number.isFinite(approval) && Number.isFinite(validation) && validation < approval) {
    blockers.push('institution_validation_precedes_approval');
  }
  if (row.financial_case_pending !== false) blockers.push('operational_issue_pending');

  return {
    operationalRequirementsMet: blockers.length === 0,
    requirementsMet: false,
    blockers: [...blockers, 'institutional_pickup_pending'],
    logisticsResponsibility: 'institution',
    payoutAllowed: false,
    payoutStatus: 'not_applicable',
  };
}
