export function exchangeDifferenceRefund({
  grossAmountCents,
  nonRecoverableProviderFeeCents,
  providerFeeEvidenceReference,
  payerAccepted,
  collectionStarted,
}) {
  const gross = grossAmountCents;
  const fee = nonRecoverableProviderFeeCents;
  const evidence = String(providerFeeEvidenceReference ?? "").trim();
  if (!Number.isSafeInteger(gross) || gross <= 0 || !Number.isSafeInteger(fee) || fee < 0 || fee > gross
      || collectionStarted !== false || payerAccepted !== true || !/^[A-Za-z0-9._:-]{3,128}$/.test(evidence)) {
    throw new Error("invalid_exchange_difference_refund");
  }
  return Object.freeze({
    grossAmountCents: gross,
    nonRecoverableProviderFeeCents: fee,
    refundAmountCents: gross - fee,
    destination: "payment_origin",
    providerFeeEvidenceReference: evidence,
    status: "approved",
  });
}
