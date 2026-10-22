import assert from "node:assert/strict";
import test from "node:test";
import { DELIVERY_ROUTE_ORDER, selectDeliveryRoute } from "../packages/contracts/delivery-routing.js";

test("delivery routing preserves the approved fallback order", () => {
  assert.deepEqual(DELIVERY_ROUTE_ORDER, [
    "lalamove", "fraldacycle_courier", "loggi_express", "uber_direct",
  ]);
  const selected = selectDeliveryRoute({
    lalamove: { available: false, homologated: true },
    fraldacycle_courier: { available: true, eligibleCourierAvailable: true },
    loggi_express: { available: true, homologated: true },
  });
  assert.equal(selected.selected, "fraldacycle_courier");
  assert.equal(selected.requiresNewQuote, true);
  assert.equal(selected.requiresPayerConfirmation, true);
  assert.equal(selected.automaticSwitchAllowed, true);
});

test("unhomologated providers and unavailable registered couriers are skipped", () => {
  const selected = selectDeliveryRoute({
    lalamove: { available: false, homologated: true },
    fraldacycle_courier: { available: true, eligibleCourierAvailable: false },
    loggi_express: { available: true, homologated: false },
    uber_direct: { available: true, homologated: true },
  });
  assert.equal(selected.selected, "uber_direct");
  assert.deepEqual(selected.evaluations.map(item => item.route), [
    "lalamove", "fraldacycle_courier", "loggi_express", "uber_direct",
  ]);
});

test("a processed payment forbids automatic provider or modality replacement", () => {
  const selected = selectDeliveryRoute({
    fraldacycle_courier: { available: true, eligibleCourierAvailable: true },
  }, { paymentProcessed: true });
  assert.equal(selected.selected, "fraldacycle_courier");
  assert.equal(selected.automaticSwitchAllowed, false);
  assert.equal(selected.supportRequired, true);
  assert.equal(selected.requiresPayerConfirmation, true);
});

test("local pickup and postal delivery are not part of the pilot fallback chain", () => {
  const none = selectDeliveryRoute({
    pickup: { available: true, offeredByListing: true },
    postal: { available: true, offeredByListing: true },
  });
  assert.equal(none.selected, null);
});
