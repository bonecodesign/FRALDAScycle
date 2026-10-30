import { externalPartnerDeliveryCharge } from '../../packages/contracts/commercial-rules.js';
import { lalamoveQuoteReadiness as deliveryRouteReadiness } from '../../packages/contracts/lalamove-quote-readiness.js';

export function createUberDirectQuoteAdapter({ client, enabled = false, now = Date.now } = {}) {
  return async function quote(input) {
    if (!enabled || !client) return { available: false, reason: 'provider_not_homologated' };
    const readiness = deliveryRouteReadiness({ ...input, now: now() });
    if (!readiness.ready) return {
      available: false,
      reason: readiness.blockers.includes('address_consent_missing')
        ? 'address_consent_missing' : 'outside_coverage',
    };
    const providerQuote = await client.quote({ transactionId: input.transactionId, stops: readiness.stops });
    const charge = externalPartnerDeliveryCharge(providerQuote.priceCents);
    return {
      available: true,
      quote: Object.freeze({
        provider: 'uber_direct',
        quoteId: providerQuote.quoteId,
        baseFreightCents: providerQuote.priceCents,
        platformFeeCents: charge.platformCents,
        customerTotalCents: charge.customerTotalCents,
        currency: 'BRL',
        expiresAt: providerQuote.expiresAt,
      }),
    };
  };
}
