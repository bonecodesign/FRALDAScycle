import { randomUUID } from 'node:crypto';
import { registeredCourierQuote } from '../../packages/contracts/registered-courier-quote.js';

export function createRegisteredCourierQuoteAdapter({ repository, enabled = false,
  now = Date.now, quoteTtlMs = 5 * 60 * 1000 } = {}) {
  return async function quote(input) {
    if (!enabled || !repository) return { available: false, reason: 'provider_not_configured' };
    const latitude = Number(input?.destination?.geocode?.latitude);
    const longitude = Number(input?.destination?.geocode?.longitude);
    if (!input?.senderId || !input?.recipientId || input.senderId === input.recipientId ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { available: false, reason: 'eligible_courier_unavailable' };
    }
    const issuedAt = now();
    const candidates = repository.rankEligible
      ? await repository.rankEligible({ senderId: input.senderId,
      recipientId: input.recipientId, recipientLatitude: latitude,
      recipientLongitude: longitude, now: new Date(issuedAt).toISOString() })
      : [await repository.closestEligible({ senderId: input.senderId,
        recipientId: input.recipientId, recipientLatitude: latitude,
        recipientLongitude: longitude, now: new Date(issuedAt).toISOString() })].filter(Boolean);
    if (!candidates.length) return { available: false, reason: 'eligible_courier_unavailable' };

    const calculated = registeredCourierQuote({ distanceKm: Number(input.routeDistanceKm),
      quoteId: `fc-${randomUUID()}`, expiresAt: new Date(issuedAt + quoteTtlMs).toISOString() },
    { now: issuedAt });
    if (!calculated.ready) return { available: false, reason: 'outside_coverage' };
    return { available: true, quote: Object.freeze({
      provider: calculated.quote.provider, quoteId: calculated.quote.quoteId,
      baseFreightCents: calculated.quote.freightCents,
      platformFeeCents: calculated.quote.platformCents,
      customerTotalCents: calculated.quote.customerTotalCents,
      currency: 'BRL', expiresAt: calculated.quote.expiresAt,
      courierId: candidates[0].courierId,
      courierDistanceToRecipientKm: candidates[0].distanceToRecipientKm,
      courierCandidates:Object.freeze(candidates.map((candidate,index)=>Object.freeze({
        courierId:candidate.courierId,priority:index+1,
        distanceToRecipientKm:candidate.distanceToRecipientKm,
      }))),
    }) };
  };
}
