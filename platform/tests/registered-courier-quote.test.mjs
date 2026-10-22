import assert from "node:assert/strict";
import test from "node:test";
import { PILOT_COURIER_BAND_LIMITS_KM, PILOT_COURIER_RATE_BANDS, registeredCourierAcceptance, registeredCourierQuote } from "../packages/contracts/registered-courier-quote.js";

const now = Date.parse("2030-01-01T12:00:00Z");
const bands = [
  { maxKm: 5, baseFreightCents: 1_200 },
  { maxKm: 10, baseFreightCents: 1_800 },
  { maxKm: 20, baseFreightCents: 2_600 },
];

test("platform selects the distance band and preserves the courier base amount", () => {
  assert.deepEqual(PILOT_COURIER_BAND_LIMITS_KM, [5, 10, 20]);
  assert.deepEqual(PILOT_COURIER_RATE_BANDS, bands);
  const result = registeredCourierQuote({
    distanceKm: 7.25, bands, quoteId: "courier-quote-1", expiresAt: "2030-01-01T12:05:00Z",
  }, { now });
  assert.equal(result.ready, true);
  assert.deepEqual(result.quote, {
    quoteId: "courier-quote-1", provider: "fraldacycle_courier", distanceKm: 7.25,
    bandMaxKm: 10, expiresAt: "2030-01-01T12:05:00.000Z",
    freightCents: 1_800, platformCents: 90, customerTotalCents: 1_890, courierCents: 1_800,
    payerConfirmationRequired: true, courierAcceptanceRequired: true, courierMayChangePrice: false,
  });
});

test("approved pilot prices work without external tariff configuration", () => {
  const expected = [
    [5, 1_200, 60, 1_260],
    [10, 1_800, 90, 1_890],
    [20, 2_600, 130, 2_730],
  ];
  for (const [distanceKm, freightCents, platformCents, customerTotalCents] of expected) {
    const result = registeredCourierQuote({
      distanceKm, quoteId: `approved-quote-${distanceKm}`, expiresAt: "2030-01-01T12:05:00Z",
    }, { now });
    assert.equal(result.ready, true);
    assert.equal(result.quote.freightCents, freightCents);
    assert.equal(result.quote.courierCents, freightCents);
    assert.equal(result.quote.platformCents, platformCents);
    assert.equal(result.quote.customerTotalCents, customerTotalCents);
  }
});

test("courier accepts the exact fixed quote and cannot negotiate its price", () => {
  const quote = registeredCourierQuote({
    distanceKm: 3, bands, quoteId: "courier-quote-2", expiresAt: "2030-01-01T12:05:00Z",
  }, { now }).quote;
  assert.equal(registeredCourierAcceptance(quote, {
    courierId: "courier-1", acceptedQuoteId: quote.quoteId, acceptedCourierCents: quote.courierCents,
  }).accepted, true);
  const changed = registeredCourierAcceptance(quote, {
    courierId: "courier-1", acceptedQuoteId: quote.quoteId, acceptedCourierCents: quote.courierCents + 1,
  });
  assert.equal(changed.accepted, false);
  assert.equal(changed.priceNegotiationAllowed, false);
});

test("missing tariff, expired quote and distance outside coverage fail closed", () => {
  for (const input of [
    { distanceKm: 3, bands: [], quoteId: "courier-quote-3", expiresAt: "2030-01-01T12:05:00Z" },
    { distanceKm: 3, bands, quoteId: "courier-quote-4", expiresAt: "2030-01-01T12:00:00Z" },
    { distanceKm: 21, bands, quoteId: "courier-quote-5", expiresAt: "2030-01-01T12:05:00Z" },
  ]) assert.equal(registeredCourierQuote(input, { now }).ready, false);
});

test("pilot rejects tariff tables with changed, missing or additional distance bands", () => {
  for (const invalidBands of [
    bands.slice(0, 2),
    [...bands, { maxKm: 30, baseFreightCents: 3_200 }],
    [{ ...bands[0], maxKm: 4 }, bands[1], bands[2]],
  ]) {
    const result = registeredCourierQuote({
      distanceKm: 3, bands: invalidBands, quoteId: "courier-bands-invalid", expiresAt: "2030-01-01T12:05:00Z",
    }, { now });
    assert.equal(result.ready, false);
    assert.ok(result.blockers.includes("courier_rate_table_not_configured"));
  }
});
