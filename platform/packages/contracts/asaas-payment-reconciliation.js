const STATUS_CANDIDATES = Object.freeze({
  PENDING: "pending",
  CONFIRMED: "paid",
  RECEIVED: "paid",
  OVERDUE: "overdue",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
  CHARGEBACK_REQUESTED: "chargeback_pending",
  CHARGEBACK_DISPUTE: "chargeback_pending",
});

function cents(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const converted = Math.round(value * 100);
  return Math.abs(value * 100 - converted) < Number.EPSILON * Math.max(1, converted) * 8 ? converted : null;
}

// Produz evidência de conciliação, não uma autorização de transição. A futura
// aplicação financeira deve ocorrer em transação bloqueada e verificar o estado
// local novamente para resistir a eventos atrasados ou fora de ordem.
export function reconcileAsaasPayment({ expected, providerPayment, checkedAt = new Date().toISOString() }) {
  if (!expected || typeof expected.reference !== "string" || !expected.reference
    || !Number.isSafeInteger(expected.amountCents) || expected.amountCents <= 0
    || !providerPayment || providerPayment.provider !== "asaas"
    || typeof providerPayment.paymentId !== "string" || !providerPayment.paymentId
    || typeof providerPayment.reference !== "string" || !providerPayment.reference
    || typeof providerPayment.status !== "string" || !providerPayment.status
    || !Number.isFinite(Date.parse(checkedAt))) {
    throw new Error("Invalid Asaas reconciliation input");
  }

  const providerAmountCents = cents(providerPayment.value);
  const blockers = [];
  if (providerPayment.reference !== expected.reference) blockers.push("reference_mismatch");
  if (providerAmountCents == null) blockers.push("provider_amount_invalid");
  else if (providerAmountCents !== expected.amountCents) blockers.push("amount_mismatch");
  const candidateStatus = STATUS_CANDIDATES[providerPayment.status] ?? "unsupported";
  if (candidateStatus === "unsupported") blockers.push("provider_status_unsupported");

  return Object.freeze({
    provider: "asaas",
    paymentId: providerPayment.paymentId,
    reference: expected.reference,
    expectedAmountCents: expected.amountCents,
    providerAmountCents,
    providerStatus: providerPayment.status,
    candidateStatus,
    matched: blockers.length === 0,
    blockers: Object.freeze(blockers),
    checkedAt: new Date(checkedAt).toISOString(),
    financialTransitionAllowed: false,
  });
}
