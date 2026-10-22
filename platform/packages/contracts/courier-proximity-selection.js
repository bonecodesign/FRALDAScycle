const LOCATION_MAX_AGE_MS = 5 * 60 * 1000;
export const COURIER_OFFER_TTL_MS = 3 * 60 * 1000;
export const MAX_COURIER_OFFERS = 3;

export function rankEligibleCouriers(candidates, {
  recipientId,
  senderId,
  now = Date.now(),
  maxLocationAgeMs = LOCATION_MAX_AGE_MS,
} = {}) {
  if (!Array.isArray(candidates)) throw new TypeError("Courier candidates must be an array");
  const ranked = candidates.filter(candidate => {
    const verifiedAt = Date.parse(candidate?.locationVerifiedAt ?? "");
    return typeof candidate?.id === "string" && candidate.id.length > 0 &&
      candidate.id !== recipientId && candidate.id !== senderId &&
      candidate.eligible === true && candidate.available === true && candidate.accountActive === true &&
      Number.isFinite(candidate.distanceToRecipientKm) && candidate.distanceToRecipientKm >= 0 &&
      Number.isFinite(verifiedAt) && verifiedAt <= now && now - verifiedAt <= maxLocationAgeMs;
  }).sort((left, right) =>
    left.distanceToRecipientKm - right.distanceToRecipientKm || left.id.localeCompare(right.id));

  return Object.freeze(ranked.map((candidate, index) => Object.freeze({
    courierId: candidate.id,
    priority: index + 1,
    distanceToRecipientKm: candidate.distanceToRecipientKm,
    offerState: index === 0 ? "offer_pending" : "queued",
  })));
}

export function nextCourierOffer(ranking, previousOffers = []) {
  const closed = new Set(previousOffers
    .filter(offer => ["declined", "expired"].includes(offer?.status))
    .map(offer => offer.courierId));
  const active = previousOffers.find(offer => offer?.status === "pending");
  if (active) return Object.freeze({ courierId: active.courierId, reused: true, exhausted: false });
  const attempted = new Set(previousOffers.map(offer => offer?.courierId).filter(Boolean));
  if (attempted.size >= MAX_COURIER_OFFERS) {
    return Object.freeze({ courierId: null, reused: false, exhausted: true, fallback: "loggi_express" });
  }
  const next = ranking.find(candidate => !closed.has(candidate.courierId) && !attempted.has(candidate.courierId));
  return Object.freeze(next
    ? { courierId: next.courierId, reused: false, exhausted: false, fallback: null }
    : { courierId: null, reused: false, exhausted: true, fallback: "loggi_express" });
}

export function courierOfferState(offer, { now = Date.now() } = {}) {
  const offeredAt = Date.parse(offer?.offeredAt ?? "");
  if (!offer?.courierId || !Number.isFinite(offeredAt) || offeredAt > now) {
    return Object.freeze({ status: "invalid", acceptAllowed: false, expiresAt: null });
  }
  const expiresAt = offeredAt + COURIER_OFFER_TTL_MS;
  if (offer.status === "declined") {
    return Object.freeze({ status: "declined", acceptAllowed: false, expiresAt: new Date(expiresAt).toISOString() });
  }
  if (offer.status === "accepted" && offeredAt <= now && now < expiresAt) {
    return Object.freeze({ status: "accepted", acceptAllowed: false, expiresAt: new Date(expiresAt).toISOString() });
  }
  const expired = now >= expiresAt;
  return Object.freeze({
    status: expired ? "expired" : "pending",
    acceptAllowed: !expired,
    expiresAt: new Date(expiresAt).toISOString(),
  });
}
