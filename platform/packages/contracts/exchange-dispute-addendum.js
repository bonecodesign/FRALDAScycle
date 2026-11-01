export function exchangeDisputeAddendum({ analysisReference }) {
  const reference = String(analysisReference ?? "").trim();
  if (reference.length < 3 || reference.length > 200 || /[\r\n]/.test(reference)) {
    throw new Error("invalid_exchange_dispute_addendum");
  }
  return Object.freeze({ analysisReference: reference });
}
