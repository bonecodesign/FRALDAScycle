import assert from 'node:assert/strict';
import test from 'node:test';
import { createLalamoveQuoteAdapter } from '../apps/api/lalamove-quote-adapter.js';
import { loadConfig } from '../apps/api/config.js';
import { createDeliveryQuoteService } from '../apps/api/delivery-quote-service.js';

const now = Date.parse('2030-01-01T12:00:00Z');
const transactionId = 'transaction-1';
const participant = (ownerId, suffix) => ({
  address: { id: `address-${suffix}`, street: 'Rua Teste', number: '10', district: 'Centro',
    city: 'Belo Horizonte', state: 'MG', postalCode: '30110000' },
  geocode: { addressId: `address-${suffix}`, latitude: -19.92, longitude: -43.94,
    verifiedAt: '2030-01-01T11:00:00Z' },
  consent: { transactionId, ownerId, addressId: `address-${suffix}`,
    noticeVersion: 'FC-DELIVERY-QUOTE-1', revokedAt: null },
});

test('Lalamove adapter remains inert until explicitly enabled', async () => {
  let calls = 0;
  const adapter = createLalamoveQuoteAdapter({ client: { async quote() { calls += 1; } } });
  assert.deepEqual(await adapter({}), { available: false, reason: 'provider_not_configured' });
  assert.equal(calls, 0);
});

test('Lalamove runtime configuration is opt-in and requires isolated credentials', () => {
  assert.equal(loadConfig({ NODE_ENV: 'test' }).lalamoveQuotingEnabled, false);
  assert.throws(() => loadConfig({ NODE_ENV: 'test', LALAMOVE_QUOTING_ENABLED: 'true' }),
    /API key and secret/);
  const config = loadConfig({ NODE_ENV: 'test', LALAMOVE_QUOTING_ENABLED: 'true',
    LALAMOVE_API_KEY: 'key', LALAMOVE_API_SECRET: 'secret' });
  assert.equal(config.lalamoveQuotingEnabled, true);
  assert.equal(config.lalamoveEnvironment, 'sandbox');
});

test('delivery quote service exposes orchestration only through the authorized-route boundary', async () => {
  let received;
  const service = createDeliveryQuoteService({}, { orchestrator: { async quote(input, options) {
    received = { input, options }; return { selected: null };
  } } });
  assert.deepEqual(await service.calculateAuthorizedRoute({ transactionId }, { paymentProcessed: false }),
    { selected: null });
  assert.deepEqual(received, { input: { transactionId }, options: { paymentProcessed: false } });
  assert.throws(() => createDeliveryQuoteService({}).calculateAuthorizedRoute({}),
    /Cálculo de frete não está habilitado/);
});

test('Lalamove adapter requires transaction-bound address consent before calling provider', async () => {
  let calls = 0;
  const adapter = createLalamoveQuoteAdapter({ enabled: true, now: () => now,
    client: { async quote() { calls += 1; } } });
  const result = await adapter({ transactionId, origin: participant('seller', 'seller'),
    destination: { ...participant('buyer', 'buyer'), consent: null } });
  assert.equal(result.available, false);
  assert.equal(result.reason, 'address_consent_missing');
  assert.equal(calls, 0);
});

test('Lalamove adapter preserves provider price and adds the FraldaCycle five percent fee', async () => {
  let receivedStops;
  const adapter = createLalamoveQuoteAdapter({ enabled: true, now: () => now, client: {
    async quote({ stops }) {
      receivedStops = stops;
      return { quotationId: 'lalamove-quote-1', expiresAt: '2030-01-01T12:05:00Z',
        priceBreakdown: { currency: 'BRL', total: '20.00' } };
    },
  } });
  const result = await adapter({ transactionId, origin: participant('seller', 'seller'),
    destination: participant('buyer', 'buyer') });
  assert.equal(receivedStops.length, 2);
  assert.deepEqual(result.quote, { provider: 'lalamove', quoteId: 'lalamove-quote-1',
    baseFreightCents: 2000, platformFeeCents: 100, customerTotalCents: 2100,
    currency: 'BRL', expiresAt: '2030-01-01T12:05:00.000Z' });
});

test('Lalamove adapter fails closed on malformed monetary response', async () => {
  const adapter = createLalamoveQuoteAdapter({ enabled: true, now: () => now, client: {
    async quote() { return { quotationId: 'lalamove-quote-1', expiresAt: '2030-01-01T12:05:00Z',
      priceBreakdown: { currency: 'BRL', total: '20,00' } }; },
  } });
  await assert.rejects(adapter({ transactionId, origin: participant('seller', 'seller'),
    destination: participant('buyer', 'buyer') }), /Invalid Lalamove quotation price/);
});
