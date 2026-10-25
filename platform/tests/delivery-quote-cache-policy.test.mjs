import assert from "node:assert/strict";
import test from "node:test";
import {
  DELIVERY_QUOTE_CACHE_CONTROL,
  DELIVERY_QUOTE_REUSE_MS,
  createDeliveryQuoteCacheRecord,
  deliveryQuoteRequestFingerprint,
  deliveryQuoteReuseDecision,
} from "../packages/contracts/delivery-quote-cache-policy.js";

const request = Object.freeze({ originAddressId: "origin-1", originAddressVersion: 2,
  destinationAddressId: "destination-1", destinationAddressVersion: 4, mode: "motorcycle",
  listingId: "listing-1", quantity: 2, packageVersion: 1 });
const quote = Object.freeze({ quoteId: "lalamove-quote-1", provider: "lalamove",
  customerTotalCents: 1890, currency: "BRL", expiresAt: "2030-01-01T12:20:00Z" });
const issued = new Date("2030-01-01T12:00:00Z");

test("checkout quote is reusable for at most ten minutes with identical inputs", () => {
  const record = createDeliveryQuoteCacheRecord(quote, request, { now: issued });
  assert.equal(record.reusableUntil, "2030-01-01T12:10:00.000Z");
  assert.equal(DELIVERY_QUOTE_REUSE_MS, 600_000);
  assert.equal(DELIVERY_QUOTE_CACHE_CONTROL, "private, max-age=600");
  assert.equal(deliveryQuoteReuseDecision(record, request,
    { now: new Date("2030-01-01T12:09:59Z") }).reuse, true);
  const expired = deliveryQuoteReuseDecision(record, request, { now: new Date("2030-01-01T12:10:00Z") });
  assert.equal(expired.recalculate, true);
  assert.equal(expired.blocker, "delivery_quote_expired");
});

test("provider expiry shortens the reuse window and estimates are recalculated at checkout", () => {
  const short = createDeliveryQuoteCacheRecord({ ...quote, expiresAt: "2030-01-01T12:03:00Z" }, request, { now: issued });
  assert.equal(short.reusableUntil, "2030-01-01T12:03:00.000Z");
  const estimate = createDeliveryQuoteCacheRecord(quote, request, { purpose: "estimate", now: issued });
  assert.equal(deliveryQuoteReuseDecision(estimate, request, { now: issued }).blocker,
    "checkout_recalculation_required");
});

test("address, mode, quantity or package changes force a fresh quote", () => {
  const record = createDeliveryQuoteCacheRecord(quote, request, { now: issued });
  for (const change of [
    { destinationAddressVersion: 5 }, { mode: "car" }, { quantity: 3 }, { packageVersion: 2 },
  ]) {
    const result = deliveryQuoteReuseDecision(record, { ...request, ...change }, { now: issued });
    assert.equal(result.recalculate, true);
    assert.equal(result.blocker, "delivery_quote_inputs_changed");
  }
  assert.notEqual(deliveryQuoteRequestFingerprint(request), deliveryQuoteRequestFingerprint({ ...request, quantity: 3 }));
});

test("processed payment locks provider and price changes for support", () => {
  const record = createDeliveryQuoteCacheRecord(quote, request, { now: issued });
  assert.deepEqual(deliveryQuoteReuseDecision(record, request, { paymentProcessed: true, now: issued }), {
    reuse: false, recalculate: false, blocker: "paid_transaction_locked", supportRequired: true,
  });
});
