import { deliverySplit } from "./commercial-rules.js";

export function freightQuoteConfirmation(quote, { now = Date.now() } = {}) {
  const blockers = [];
  const quotationId = String(quote?.quotationId ?? "").trim();
  const expiresAt = Date.parse(quote?.expiresAt ?? "");
  const baseFreightCents = quote?.baseFreightCents;
  const confirmedTotalCents = quote?.confirmation?.totalCents;
  const confirmedQuoteId = String(quote?.confirmation?.quotationId ?? "").trim();

  if (!quotationId || !Number.isFinite(expiresAt) || !Number.isSafeInteger(baseFreightCents) || baseFreightCents <= 0) {
    blockers.push("invalid_freight_quote");
  }
  if (Number.isFinite(expiresAt) && expiresAt <= now) blockers.push("freight_quote_expired");

  let charge = null;
  if (blockers.length === 0) {
    charge = deliverySplit(baseFreightCents);
    if (confirmedQuoteId !== quotationId || confirmedTotalCents !== charge.customerTotalCents) {
      blockers.push("freight_quote_confirmation_required");
    }
  }

  return Object.freeze({
    readyForPayment: blockers.length === 0,
    state: blockers.includes("freight_quote_expired") ? "requote_required"
      : blockers.length ? "confirmation_required" : "confirmed",
    automaticPriceVariationAllowed: false,
    blockers: Object.freeze([...new Set(blockers)]),
    charge: blockers.includes("invalid_freight_quote") ? null : charge,
  });
}
