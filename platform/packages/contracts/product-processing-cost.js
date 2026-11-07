import {saleSplit} from "./commercial-rules.js";

// Financial preparation only. Fee amounts are unknown until contractual evidence
// and provider reconciliation exist. Synthetic scenarios are never payout proof.
export function projectProductProcessingCost({productAmountCents, simulatedProviderFeeCents = null}) {
  if (!Number.isSafeInteger(productAmountCents) || productAmountCents <= 0 || productAmountCents > 2147483647) {
    throw new RangeError("Invalid product amount for processing projection");
  }
  if (simulatedProviderFeeCents !== null &&
    (!Number.isSafeInteger(simulatedProviderFeeCents) || simulatedProviderFeeCents < 0)) {
    throw new RangeError("Invalid simulated processing fee");
  }
  const split = saleSplit(productAmountCents);
  const insufficient = simulatedProviderFeeCents !== null
    && simulatedProviderFeeCents > split.sellerCents;
  return Object.freeze({
    currency: "BRL",
    buyerProductAmountCents: productAmountCents,
    platformProductFeeCents: split.platformCents,
    sellerBeforeProcessingFeeCents: split.sellerCents,
    processingFeePayer: "seller",
    providerProcessingFeeCents: simulatedProviderFeeCents,
    sellerAfterProcessingFeeCents: simulatedProviderFeeCents === null || insufficient
      ? null : split.sellerCents - simulatedProviderFeeCents,
    simulationOnly: true,
    feeHomologated: false,
    providerReconciled: false,
    payoutAllowed: false,
    blockers: Object.freeze([
      simulatedProviderFeeCents === null ? "processor_fee_unknown" : "processor_fee_unhomologated",
      ...(insufficient ? ["seller_margin_insufficient"] : []),
      "processor_contract_not_homologated",
    ]),
  });
}
