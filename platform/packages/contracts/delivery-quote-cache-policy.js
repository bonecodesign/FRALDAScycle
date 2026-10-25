import { createHash } from "node:crypto";

export const DELIVERY_QUOTE_REUSE_MS = 10 * 60 * 1_000;
export const DELIVERY_QUOTE_CACHE_CONTROL = "private, max-age=600";

const PURPOSES = new Set(["estimate", "checkout"]);

function text(value, maximum = 160) {
  const normalized = String(value ?? "").trim();
  return normalized && normalized.length <= maximum ? normalized : null;
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function deliveryQuoteRequestFingerprint(request) {
  const canonical = {
    originAddressId: text(request?.originAddressId),
    originAddressVersion: positiveInteger(request?.originAddressVersion),
    destinationAddressId: text(request?.destinationAddressId),
    destinationAddressVersion: positiveInteger(request?.destinationAddressVersion),
    mode: text(request?.mode, 60),
    listingId: text(request?.listingId),
    quantity: positiveInteger(request?.quantity),
    packageVersion: positiveInteger(request?.packageVersion),
  };
  if (Object.values(canonical).some(value => value === null)) {
    throw Object.assign(new Error("Invalid delivery quote request"), { code: "invalid_delivery_quote_request" });
  }
  return createHash("sha256").update(JSON.stringify(canonical)).digest("base64url");
}

export function createDeliveryQuoteCacheRecord(quote, request, {
  purpose = "checkout", now = new Date(),
} = {}) {
  const issuedAt = now instanceof Date ? now.getTime() : Date.parse(now);
  const providerExpiry = Date.parse(quote?.expiresAt ?? "");
  const quoteId = text(quote?.quoteId ?? quote?.quotationId);
  const totalCents = quote?.customerTotalCents ?? quote?.totalCents;
  if (!PURPOSES.has(purpose) || !Number.isFinite(issuedAt) || !Number.isFinite(providerExpiry)
      || providerExpiry <= issuedAt || !quoteId || !Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw Object.assign(new Error("Invalid delivery quote cache record"), { code: "invalid_delivery_quote" });
  }
  const reusableUntil = Math.min(providerExpiry, issuedAt + DELIVERY_QUOTE_REUSE_MS);
  return Object.freeze({
    quoteId,
    provider: text(quote.provider, 80),
    customerTotalCents: totalCents,
    currency: quote.currency === "BRL" ? "BRL" : null,
    purpose,
    requestFingerprint: deliveryQuoteRequestFingerprint(request),
    issuedAt: new Date(issuedAt).toISOString(),
    reusableUntil: new Date(reusableUntil).toISOString(),
  });
}

export function deliveryQuoteReuseDecision(record, request, {
  stage = "checkout", paymentProcessed = false, now = new Date(),
} = {}) {
  if (paymentProcessed) return Object.freeze({ reuse: false, recalculate: false,
    blocker: "paid_transaction_locked", supportRequired: true });
  if (stage !== "checkout") return Object.freeze({ reuse: false, recalculate: true,
    blocker: "checkout_recalculation_required", supportRequired: false });
  let fingerprint;
  try { fingerprint = deliveryQuoteRequestFingerprint(request); }
  catch { return Object.freeze({ reuse: false, recalculate: false,
    blocker: "invalid_delivery_quote_request", supportRequired: false }); }
  const current = now instanceof Date ? now.getTime() : Date.parse(now);
  const reusableUntil = Date.parse(record?.reusableUntil ?? "");
  if (record?.purpose !== "checkout") return Object.freeze({ reuse: false, recalculate: true,
    blocker: "checkout_recalculation_required", supportRequired: false });
  if (record.requestFingerprint !== fingerprint) return Object.freeze({ reuse: false, recalculate: true,
    blocker: "delivery_quote_inputs_changed", supportRequired: false });
  if (!Number.isFinite(current) || !Number.isFinite(reusableUntil) || reusableUntil <= current) {
    return Object.freeze({ reuse: false, recalculate: true,
      blocker: "delivery_quote_expired", supportRequired: false });
  }
  return Object.freeze({ reuse: true, recalculate: false, blocker: null, supportRequired: false,
    quoteId: record.quoteId, customerTotalCents: record.customerTotalCents,
    reusableUntil: record.reusableUntil });
}
