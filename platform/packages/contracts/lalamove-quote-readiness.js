// Local preparation only. The current address-share flow happens after a
// courier is assigned, so a real pre-order quotation needs a new consent step.
export function lalamoveQuoteReadiness({ origin, destination, transactionId, now = Date.now() }) {
  const blockers = [];
  if (!transactionId || !origin?.consent || !destination?.consent
    || origin.consent.transactionId !== transactionId || destination.consent.transactionId !== transactionId
    || origin.consent.ownerId === destination.consent.ownerId
    || origin.consent.revokedAt || destination.consent.revokedAt
    || origin.consent.addressId !== origin.address?.id || destination.consent.addressId !== destination.address?.id
    || origin.consent.noticeVersion !== "FC-DELIVERY-QUOTE-1" || destination.consent.noticeVersion !== "FC-DELIVERY-QUOTE-1") {
    blockers.push("address_consent_missing");
  }
  const stops = [origin, destination].map(entry => {
    const address = entry?.address;
    const geo = entry?.geocode;
    if (!address || address.city?.trim().toLowerCase() !== "belo horizonte"
      || address.state?.toUpperCase() !== "MG" || !/^\d{8}$/.test(String(address.postalCode ?? ""))) {
      blockers.push("pilot_address_invalid");
    }
    const lat = Number(geo?.latitude);
    const lng = Number(geo?.longitude);
    if (geo?.latitude == null || geo?.longitude == null || !Number.isFinite(lat) || !Number.isFinite(lng)
      || lat < -90 || lat > 90 || lng < -180 || lng > 180
      || geo.addressId !== address?.id || !Number.isFinite(Date.parse(geo?.verifiedAt))
      || Date.parse(geo.verifiedAt) > now) blockers.push("geocode_unverified");
    return {
      address: [address?.street, address?.number, address?.district, address?.city, address?.state, address?.postalCode]
        .filter(Boolean).join(", "),
      coordinates: { lat, lng },
    };
  });
  const ready = blockers.length === 0;
  return Object.freeze({ ready, blockers: Object.freeze([...new Set(blockers)]), stops: ready ? Object.freeze(stops) : null });
}

export function pilotQuotePresentation(input) {
  const check = lalamoveQuoteReadiness(input);
  return Object.freeze({
    state: check.ready ? "ready_to_request_quote" : "awaiting_route_authorization",
    priceCents: null,
    canRequestProviderQuote: check.ready,
    blockers: check.blockers,
  });
}
