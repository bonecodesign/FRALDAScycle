const FIELDS = Object.freeze([
  "deliveryProofReference",
  "supportHistoryReference",
  "paymentStatusReference",
  "logisticsStatusReference",
  "requesterStatementReference",
  "ownerStatementReference",
]);

export function exchangeDisputeEvidence(input = {}) {
  const normalized = {};
  for (const field of FIELDS) {
    const value = String(input[field] ?? "").trim();
    if (value.length < 3 || value.length > 200 || /[\r\n]/.test(value)) {
      throw new Error("invalid_exchange_dispute_evidence");
    }
    normalized[field] = value;
  }
  return Object.freeze(normalized);
}

export const EXCHANGE_DISPUTE_EVIDENCE_FIELDS = FIELDS;
