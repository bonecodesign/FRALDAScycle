import assert from "node:assert/strict";
import test from "node:test";
import { freightQuoteConfirmation } from "../packages/contracts/freight-quote-confirmation.js";

const now = Date.parse("2030-01-01T12:00:00Z");
const quote = {
  quotationId: "quote-1",
  baseFreightCents: 2_000,
  expiresAt: "2030-01-01T12:05:00Z",
};

test("a current quote requires exact confirmation of its total", () => {
  const pending = freightQuoteConfirmation(quote, { now });
  assert.equal(pending.readyForPayment, false);
  assert.equal(pending.state, "confirmation_required");
  assert.deepEqual(pending.charge, {
    freightCents: 2_000, platformCents: 100, customerTotalCents: 2_100, courierCents: 2_000,
  });

  const confirmed = freightQuoteConfirmation({
    ...quote, confirmation: { quotationId: "quote-1", totalCents: 2_100 },
  }, { now });
  assert.equal(confirmed.readyForPayment, true);
  assert.equal(confirmed.state, "confirmed");
  assert.equal(confirmed.automaticPriceVariationAllowed, false);
});

test("an expired or changed quote always requires requotation or a new confirmation", () => {
  const expired = freightQuoteConfirmation({
    ...quote, expiresAt: "2030-01-01T12:00:00Z",
    confirmation: { quotationId: "quote-1", totalCents: 2_100 },
  }, { now });
  assert.equal(expired.readyForPayment, false);
  assert.equal(expired.state, "requote_required");
  assert.ok(expired.blockers.includes("freight_quote_expired"));

  const changed = freightQuoteConfirmation({
    ...quote, quotationId: "quote-2", baseFreightCents: 2_100,
    confirmation: { quotationId: "quote-1", totalCents: 2_100 },
  }, { now });
  assert.equal(changed.readyForPayment, false);
  assert.ok(changed.blockers.includes("freight_quote_confirmation_required"));
  assert.equal(changed.charge.customerTotalCents, 2_205);
});
