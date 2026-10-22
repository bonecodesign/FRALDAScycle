import assert from "node:assert/strict";
import test from "node:test";
import { COURIER_OFFER_TTL_MS, MAX_COURIER_OFFERS, courierOfferState, nextCourierOffer, rankEligibleCouriers } from "../packages/contracts/courier-proximity-selection.js";

const now = Date.parse("2030-01-01T12:00:00Z");
const verified = "2030-01-01T11:58:00Z";

test("the closest eligible active courier to the recipient receives first priority", () => {
  const ranked = rankEligibleCouriers([
    { id: "courier-b", eligible: true, available: true, accountActive: true, distanceToRecipientKm: 4.2, locationVerifiedAt: verified },
    { id: "courier-a", eligible: true, available: true, accountActive: true, distanceToRecipientKm: 1.4, locationVerifiedAt: verified },
    { id: "courier-c", eligible: true, available: true, accountActive: true, distanceToRecipientKm: 2.8, locationVerifiedAt: verified },
  ], { recipientId: "buyer", senderId: "seller", now });
  assert.deepEqual(ranked.map(item => item.courierId), ["courier-a", "courier-c", "courier-b"]);
  assert.equal(ranked[0].offerState, "offer_pending");
  assert.equal(ranked[1].offerState, "queued");
});

test("participants, unavailable accounts and stale or invalid locations are excluded", () => {
  const ranked = rankEligibleCouriers([
    { id: "buyer", eligible: true, available: true, accountActive: true, distanceToRecipientKm: 0, locationVerifiedAt: verified },
    { id: "seller", eligible: true, available: true, accountActive: true, distanceToRecipientKm: 1, locationVerifiedAt: verified },
    { id: "inactive", eligible: true, available: true, accountActive: false, distanceToRecipientKm: 1, locationVerifiedAt: verified },
    { id: "stale", eligible: true, available: true, accountActive: true, distanceToRecipientKm: 1, locationVerifiedAt: "2030-01-01T11:54:59Z" },
    { id: "valid", eligible: true, available: true, accountActive: true, distanceToRecipientKm: 3, locationVerifiedAt: verified },
  ], { recipientId: "buyer", senderId: "seller", now });
  assert.deepEqual(ranked.map(item => item.courierId), ["valid"]);
});

test("offers advance sequentially and never compete while one is pending", () => {
  const ranking = [{ courierId: "near" }, { courierId: "middle" }, { courierId: "far" }];
  assert.deepEqual(nextCourierOffer(ranking), { courierId: "near", reused: false, exhausted: false, fallback: null });
  assert.deepEqual(nextCourierOffer(ranking, [{ courierId: "near", status: "pending" }]),
    { courierId: "near", reused: true, exhausted: false });
  assert.deepEqual(nextCourierOffer(ranking, [{ courierId: "near", status: "declined" }]),
    { courierId: "middle", reused: false, exhausted: false, fallback: null });
  assert.deepEqual(nextCourierOffer(ranking, [
    { courierId: "near", status: "declined" }, { courierId: "middle", status: "expired" },
    { courierId: "far", status: "declined" },
  ]), { courierId: null, reused: false, exhausted: true, fallback: "loggi_express" });
});

test("each courier offer expires at exactly three minutes", () => {
  assert.equal(COURIER_OFFER_TTL_MS, 180_000);
  const offer = { courierId: "near", offeredAt: "2030-01-01T12:00:00Z", status: "pending" };
  const active = courierOfferState(offer, { now: Date.parse("2030-01-01T12:02:59.999Z") });
  assert.equal(active.status, "pending");
  assert.equal(active.acceptAllowed, true);
  assert.equal(active.expiresAt, "2030-01-01T12:03:00.000Z");
  const expired = courierOfferState(offer, { now: Date.parse("2030-01-01T12:03:00Z") });
  assert.equal(expired.status, "expired");
  assert.equal(expired.acceptAllowed, false);
});

test("three unsuccessful offers cap the wait at nine minutes before Loggi", () => {
  assert.equal(MAX_COURIER_OFFERS, 3);
  assert.equal(MAX_COURIER_OFFERS * COURIER_OFFER_TTL_MS, 9 * 60 * 1000);
  const ranking = ["a", "b", "c", "d"].map(courierId => ({ courierId }));
  const result = nextCourierOffer(ranking, [
    { courierId: "a", status: "expired" },
    { courierId: "b", status: "declined" },
    { courierId: "c", status: "expired" },
  ]);
  assert.deepEqual(result, { courierId: null, reused: false, exhausted: true, fallback: "loggi_express" });
});
