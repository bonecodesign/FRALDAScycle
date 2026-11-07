import { externalPartnerDeliveryCharge, saleSplit } from "./commercial-rules.js";

const PROVIDERS = new Set(["lalamove", "fraldacycle_courier", "loggi_express", "uber_direct"]);

export function freightAllocation(quote) {
  if (!PROVIDERS.has(quote?.provider)
    || !Number.isSafeInteger(quote?.baseFreightCents)
    || quote.baseFreightCents <= 0
    || !Number.isSafeInteger(quote?.platformFeeCents)
    || !Number.isSafeInteger(quote?.customerTotalCents)
    || quote.currency !== "BRL") {
    throw new RangeError("Invalid freight settlement quote");
  }
  const calculated = externalPartnerDeliveryCharge(quote.baseFreightCents);
  if (calculated.platformCents !== quote.platformFeeCents
    || calculated.customerTotalCents !== quote.customerTotalCents) {
    throw new RangeError("Freight settlement quote amount mismatch");
  }
  return Object.freeze({
    providerAmountCents: calculated.partnerCents,
    platformFeeCents: calculated.platformCents,
    customerTotalCents: calculated.customerTotalCents,
  });
}

// Local accounting comparison only. Never verifies an external provider,
// completes a charge or authorizes a payout.
export function freightSettlementReconciliation({ plan, quote, transaction, payment, paidCount = 0, financialCasePending = false }) {
  const blockers = [];
  let allocation;
  try {
    allocation = freightAllocation({
      provider: plan?.provider, baseFreightCents: plan?.provider_amount_cents,
      platformFeeCents: plan?.platform_fee_cents,
      customerTotalCents: plan?.customer_total_cents, currency: "BRL",
    });
  } catch {
    blockers.push("plan_allocation_invalid");
  }
  if (!quote || quote.id !== plan?.delivery_quote_id
    || !["confirmed", "locked"].includes(quote.status)
    || quote.confirmed_by !== plan?.payer_id
    || quote.provider !== plan?.provider
    || quote.base_freight_cents !== plan?.provider_amount_cents
    || quote.platform_fee_cents !== plan?.platform_fee_cents
    || quote.customer_total_cents !== plan?.customer_total_cents) {
    blockers.push("quote_changed_or_unconfirmed");
  }
  if (!transaction || transaction.id !== plan?.transaction_id
    || !["sale", "exchange"].includes(transaction.kind)) {
    blockers.push("transaction_invalid");
  }
  if (transaction?.kind === "exchange") {
    blockers.push("exchange_leg_payment_not_configured");
  }
  if (!payment || payment.status !== "paid" || !payment.provider_reference) {
    blockers.push("payment_not_confirmed");
  }
  if (paidCount !== 1) blockers.push("payment_cardinality_invalid");
  if (financialCasePending) blockers.push("financial_case_pending");

  if (allocation && transaction?.kind === "sale") {
    const productCents = Number(transaction.amount_cents);
    if (!Number.isSafeInteger(productCents) || productCents <= 0) {
      blockers.push("product_amount_invalid");
    } else {
      const split = saleSplit(productCents);
      const expectedAmount = productCents + allocation.customerTotalCents;
      const expectedPlatform = split.platformCents + allocation.platformFeeCents;
      if (!Number.isSafeInteger(expectedAmount)
        || expectedAmount > 2147483647
        || !payment
        || payment.amount_cents !== expectedAmount
        || payment.platform_fee_cents !== expectedPlatform
        || payment.delivery_fee_cents !== allocation.providerAmountCents
        || payment.seller_amount_cents !== split.sellerCents) {
        blockers.push("payment_split_mismatch");
      }
    }
  }
  const localMatched = blockers.length === 0;
  // Provider consultation, contractual split, execution and confirmation are
  // separate activation gates. This contract intentionally cannot bypass them.
  return Object.freeze({
    localMatched,
    blockers: Object.freeze([...new Set([...blockers, "external_reconciliation_not_homologated"])]),
    providerReconciled: false,
    payoutAllowed: false,
    externalChargeCreated: false,
  });
}
