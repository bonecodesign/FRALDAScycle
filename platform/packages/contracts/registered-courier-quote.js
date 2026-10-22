import { deliverySplit } from "./commercial-rules.js";

export const PILOT_COURIER_BAND_LIMITS_KM = Object.freeze([5, 10, 20]);
export const PILOT_COURIER_RATE_BANDS = Object.freeze([
  Object.freeze({ maxKm: 5, baseFreightCents: 1_200 }),
  Object.freeze({ maxKm: 10, baseFreightCents: 1_800 }),
  Object.freeze({ maxKm: 20, baseFreightCents: 2_600 }),
]);

function validBands(bands) {
  return Array.isArray(bands) && bands.length === PILOT_COURIER_BAND_LIMITS_KM.length && bands.every((band, index) =>
    band.maxKm === PILOT_COURIER_BAND_LIMITS_KM[index] &&
    Number.isSafeInteger(band.baseFreightCents) && band.baseFreightCents > 0);
}

export function registeredCourierQuote({ distanceKm, bands = PILOT_COURIER_RATE_BANDS, quoteId, expiresAt }, { now = Date.now() } = {}) {
  const blockers = [];
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) blockers.push("invalid_route_distance");
  if (!validBands(bands)) blockers.push("courier_rate_table_not_configured");
  if (typeof quoteId !== "string" || quoteId.trim().length < 8) blockers.push("invalid_quote_id");
  const expiry = Date.parse(expiresAt ?? "");
  if (!Number.isFinite(expiry) || expiry <= now) blockers.push("invalid_or_expired_quote_window");

  const band = blockers.length === 0 ? bands.find(item => distanceKm <= item.maxKm) : null;
  if (blockers.length === 0 && !band) blockers.push("route_outside_courier_coverage");
  if (blockers.length > 0) return Object.freeze({ ready: false, blockers: Object.freeze(blockers), quote: null });

  const charge = deliverySplit(band.baseFreightCents);
  return Object.freeze({
    ready: true,
    blockers: Object.freeze([]),
    quote: Object.freeze({
      quoteId: quoteId.trim(), provider: "fraldacycle_courier", distanceKm,
      bandMaxKm: band.maxKm, expiresAt: new Date(expiry).toISOString(),
      ...charge,
      payerConfirmationRequired: true,
      courierAcceptanceRequired: true,
      courierMayChangePrice: false,
    }),
  });
}

export function registeredCourierAcceptance(quote, { courierId, acceptedQuoteId, acceptedCourierCents }) {
  const accepted = typeof courierId === "string" && courierId.length > 0 &&
    acceptedQuoteId === quote?.quoteId && acceptedCourierCents === quote?.courierCents;
  return Object.freeze({
    accepted,
    state: accepted ? "courier_accepted_fixed_quote" : "courier_acceptance_required",
    priceNegotiationAllowed: false,
  });
}
