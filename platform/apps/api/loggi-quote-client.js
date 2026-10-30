export function createLoggiQuoteClient({ endpoint, secret, fetchImpl = fetch } = {}) {
  const origin = endpoint ? new URL(endpoint) : null;
  if (!origin || origin.protocol !== 'https:' || !secret) throw new Error('Invalid Loggi quote gateway configuration');
  return Object.freeze({
    async quote({ transactionId, stops }) {
      if (typeof transactionId !== 'string' || !Array.isArray(stops) || stops.length !== 2) {
        throw new Error('Invalid Loggi quote request');
      }
      let response;
      try {
        response = await fetchImpl(new URL('/quotes', origin), { method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}`,
            'idempotency-key': `delivery-quote:${transactionId}` },
          body: JSON.stringify({ reference: transactionId, stops }), signal: AbortSignal.timeout(5_000) });
      } catch { throw new Error('Loggi quote gateway unavailable'); }
      if (!response.ok) throw new Error(`Loggi quote gateway rejected request (${response.status})`);
      const payload = await response.json();
      if (typeof payload?.quoteId !== 'string' || payload.quoteId.length < 8 ||
        !Number.isSafeInteger(payload.priceCents) || payload.priceCents <= 0 ||
        payload.currency !== 'BRL' || !Number.isFinite(Date.parse(payload.expiresAt))) {
        throw new Error('Invalid Loggi quote gateway response');
      }
      return Object.freeze({ quoteId: payload.quoteId, priceCents: payload.priceCents,
        currency: payload.currency, expiresAt: new Date(payload.expiresAt).toISOString() });
    },
  });
}
