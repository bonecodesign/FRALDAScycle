import assert from "node:assert/strict";
import test from "node:test";
import { lalamoveQuoteReadiness, pilotQuotePresentation } from "../packages/contracts/lalamove-quote-readiness.js";

const now = Date.parse("2030-01-01T00:00:00Z");
const route = {
  transactionId: "transaction-1",
  origin: { consent: { transactionId: "transaction-1", ownerId: "seller", addressId: "a", noticeVersion: "FC-DELIVERY-QUOTE-1" },
    address: { id: "a", street: "Rua A", number: "1", district: "Centro", city: "Belo Horizonte", state: "MG", postalCode: "30100000" },
    geocode: { addressId: "a", latitude: -19.9, longitude: -43.9, verifiedAt: "2029-12-31T00:00:00Z" } },
  destination: { consent: { transactionId: "transaction-1", ownerId: "buyer", addressId: "b", noticeVersion: "FC-DELIVERY-QUOTE-1" },
    address: { id: "b", street: "Rua B", number: "2", district: "Centro", city: "Belo Horizonte", state: "MG", postalCode: "30200000" },
    geocode: { addressId: "b", latitude: -19.8, longitude: -43.8, verifiedAt: "2029-12-31T00:00:00Z" } },
};

test("consented BH route produces only two minimal geocoded stops", () => {
  const result = lalamoveQuoteReadiness({ ...route, now });
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.stops.length, 2);
  assert.equal(result.stops[0].coordinates.lat, -19.9);
  assert.equal(result.stops[0].address, "Rua A, 1, Centro, Belo Horizonte, MG, 30100000");
});

test("missing consent, changed address, bad coordinates and outside-BH route stay blocked", () => {
  const scenarios = [
    [{ origin: { ...route.origin, consent: null } }, "address_consent_missing"],
    [{ origin: { ...route.origin, consent: { ...route.origin.consent, revokedAt: "2029-12-31T12:00:00Z" } } }, "address_consent_missing"],
    [{ origin: { ...route.origin, consent: { ...route.origin.consent, addressId: "other" } } }, "address_consent_missing"],
    [{ destination: { ...route.destination, consent: { ...route.destination.consent, ownerId: "seller" } } }, "address_consent_missing"],
    [{ origin: { ...route.origin, geocode: { ...route.origin.geocode, addressId: "other" } } }, "geocode_unverified"],
    [{ origin: { ...route.origin, geocode: { ...route.origin.geocode, latitude: null } } }, "geocode_unverified"],
    [{ destination: { ...route.destination, address: { ...route.destination.address, city: "Contagem" } } }, "pilot_address_invalid"],
  ];
  for (const [change, blocker] of scenarios) {
    const result = lalamoveQuoteReadiness({ ...route, ...change, now });
    assert.equal(result.ready, false);
    assert.equal(result.stops, null);
    assert.ok(result.blockers.includes(blocker));
  }
});

test("pilot does not advertise a price before both parties authorize the route", () => {
  const pending = pilotQuotePresentation({ ...route, origin: { ...route.origin, consent: null }, now });
  assert.equal(pending.state, "awaiting_route_authorization");
  assert.equal(pending.priceCents, null);
  assert.equal(pending.canRequestProviderQuote, false);
  const ready = pilotQuotePresentation({ ...route, now });
  assert.equal(ready.state, "ready_to_request_quote");
  assert.equal(ready.priceCents, null);
});
