import { freightAllocation } from "./freight-settlement.js";

// Read-only exchange freight accounting. Each recipient is independently
// responsible for their leg; no two-leg aggregate is a payable invoice.
export function exchangeFreightLegReadiness({ transactionId, buyerId, sellerId, rows, now = Date.now() }) {
  if (!transactionId || !buyerId || !sellerId || buyerId === sellerId || !Array.isArray(rows)) {
    throw new RangeError("Invalid exchange freight preview");
  }
  const participants = new Set([buyerId, sellerId]);
  const legs = [1, 2].map(number => {
    const matches = rows.filter(row => Number(row.exchange_leg) === number);
    const row = matches[0];
    const blockers = [];
    if (matches.length !== 1 || !row?.shipment_id) blockers.push("exchange_leg_missing_or_duplicated");
    if (row?.shipment_id) {
      if (row.shipment_transaction_id !== transactionId
        || row.shipment_recipient_id === row.shipment_sender_id
        || !participants.has(row.shipment_recipient_id)
        || !participants.has(row.shipment_sender_id)
        || row.shipment_payer_id !== row.shipment_recipient_id) {
        blockers.push("exchange_leg_payer_invalid");
      }
    }
    const hasQuote = Boolean(row?.quote_id);
    if (!hasQuote) blockers.push("exchange_leg_quote_missing");
    let allocation = null;
    if (hasQuote) {
      if (row.quote_shipment_id !== row.shipment_id
        || row.quote_transaction_id !== transactionId
        || !["confirmed", "locked"].includes(row.quote_status)
        || row.quote_confirmed_by !== row.shipment_payer_id
        || (row.quote_status === "confirmed"
          && (!Number.isFinite(Date.parse(row.quote_expires_at))
            || Date.parse(row.quote_expires_at) <= now))) {
        blockers.push("exchange_leg_quote_not_confirmed");
      }
      try {
        allocation = freightAllocation({
          provider: row.quote_provider,
          baseFreightCents: row.quote_base_cents,
          platformFeeCents: row.quote_platform_fee_cents,
          customerTotalCents: row.quote_total_cents,
          currency: row.quote_currency,
        });
      } catch {
        blockers.push("exchange_leg_quote_amount_invalid");
      }
    }
    if (!row?.plan_id) blockers.push("exchange_leg_plan_missing");
    else if (!hasQuote || !allocation || row.plan_quote_id !== row.quote_id
      || row.plan_transaction_id !== transactionId || row.plan_shipment_id !== row.shipment_id
      || row.plan_payer_id !== row.shipment_payer_id
      || row.plan_provider !== row.quote_provider
      || row.plan_provider_amount_cents !== allocation.providerAmountCents
      || row.plan_platform_fee_cents !== allocation.platformFeeCents
      || row.plan_total_cents !== allocation.customerTotalCents) {
      blockers.push("exchange_leg_plan_mismatch");
    }
    return Object.freeze({
      exchangeLeg: number,
      shipmentId: row?.shipment_id ?? null,
      payerId: row?.shipment_payer_id ?? null,
      quoteId: row?.quote_id ?? null,
      planId: row?.plan_id ?? null,
      provider: row?.quote_provider ?? null,
      providerAmountCents: allocation?.providerAmountCents ?? null,
      platformFeeCents: allocation?.platformFeeCents ?? null,
      payerTotalCents: allocation?.customerTotalCents ?? null,
      localReady: blockers.length === 0,
      blockers: Object.freeze(blockers),
      externalChargeCreated: false,
      payoutAllowed: false,
    });
  });
  const globalBlockers = [];
  if (rows.some(row => ![1, 2].includes(Number(row.exchange_leg)))) {
    globalBlockers.push("exchange_leg_set_invalid");
  }
  if (legs[0].shipmentId && legs[0].shipmentId === legs[1].shipmentId) {
    globalBlockers.push("exchange_shipment_not_independent");
  }
  if (legs[0].payerId && legs[0].payerId === legs[1].payerId) {
    globalBlockers.push("exchange_leg_payers_not_independent");
  }
  const localReady = legs.every(leg => leg.localReady) && globalBlockers.length === 0;
  const totals = localReady ? Object.freeze({
    providerAmountCents: legs.reduce((sum, leg) => sum + leg.providerAmountCents, 0),
    platformFeeCents: legs.reduce((sum, leg) => sum + leg.platformFeeCents, 0),
    combinedForAccountingOnlyCents: legs.reduce((sum, leg) => sum + leg.payerTotalCents, 0),
  }) : null;
  return Object.freeze({
    transactionId,
    legs: Object.freeze(legs),
    localReady,
    globalBlockers: Object.freeze(globalBlockers),
    totals,
    independentlyPayableLegs: 2,
    providerReconciled: false,
    externalChargeCreated: false,
    payoutAllowed: false,
    blockers: Object.freeze(["exchange_leg_payment_not_configured", "external_reconciliation_not_homologated"]),
  });
}
