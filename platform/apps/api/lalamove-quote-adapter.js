import { externalPartnerDeliveryCharge } from '../../packages/contracts/commercial-rules.js';
import { lalamoveQuoteReadiness } from '../../packages/contracts/lalamove-quote-readiness.js';

function amountInCents(value) {
  const normalized = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

// This adapter deliberately receives already-authorized route material. It
// does not load private addresses and cannot enable the provider by itself.
export function createLalamoveQuoteAdapter({ client, enabled = false, now = Date.now } = {}) {
  return async function quote(input) {
    if (!enabled || !client) return { available: false, reason: 'provider_not_configured' };

    const readiness = lalamoveQuoteReadiness({ ...input, now: now() });
    if (!readiness.ready) {
      return {
        available: false,
        reason: readiness.blockers.includes('address_consent_missing')
          ? 'address_consent_missing' : 'outside_coverage',
      };
    }

    const providerQuote = await client.quote({ stops: readiness.stops });
    if (providerQuote?.priceBreakdown?.currency !== 'BRL') {
      throw new Error('Invalid Lalamove quotation currency');
    }
    const baseFreightCents = amountInCents(providerQuote.priceBreakdown.total);
    if (!baseFreightCents) throw new Error('Invalid Lalamove quotation price');

    const charge = externalPartnerDeliveryCharge(baseFreightCents);
    return {
      available: true,
      quote: Object.freeze({
        provider: 'lalamove',
        quoteId: providerQuote.quotationId,
        baseFreightCents,
        platformFeeCents: charge.platformCents,
        customerTotalCents: charge.customerTotalCents,
        currency: 'BRL',
        expiresAt: new Date(providerQuote.expiresAt).toISOString(),
      }),
    };
  };
}
