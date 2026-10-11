import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderListingCard } from '../packages/contracts/marketplace-ui.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('App listing cards lead to details instead of the payment-gated chat', () => {
  const html = renderListingCard({
    id: '11111111-1111-4111-8111-111111111111', title: 'Fraldas M', kind: 'sale', status: 'published',
    package_condition: 'sealed', quantity: 24, size: 'M', price_cents: 4500,
  }, 'app');
  assert.match(html, /href="\/app\/listing\?id=11111111-1111-4111-8111-111111111111"/);
  assert.doesNotMatch(html, /href="\/app\/chat\?listing=/);
});

test('App sale detail creates the transaction before moving to payment; chat stays server-gated', async () => {
  const [listing, chat, server, exchange, exchangeBehavior, source] = await Promise.all([
    read('../apps/app/listing.js'),
    read('../apps/app/negotiation.js'),
    read('../tools/dev-server.mjs'),
    read('../apps/app/exchange.html'),
    read('../apps/app/exchange.js'),
    read('../apps/app/source.json').then(JSON.parse),
  ]);
  assert.match(listing, /\/v1\/listings\/.*\/transactions/);
  assert.ok(listing.indexOf('fc.activeTransactionId') < listing.indexOf("window.location.assign('\/app/payment')"));
  assert.match(listing, /window.location.assign\('\/app\/payment'\)/);
  assert.match(listing, /\/app\/exchange\?requestedListingId=/);
  assert.match(chat, /\/v1\/transactions\/.*chat-access/);
  assert.match(server, /"\/app\/listing"/);
  assert.match(server, /"\/app\/exchange"/);
  assert.match(exchange, /data-source-route="#\/app\/exchange"/);
  assert.match(exchange, /<select class="input" name="offeredListingId"/);
  assert.match(exchangeBehavior, /\/v1\/account\/listings/);
  assert.ok(source.destination.routes.includes('/app/listing'));
  assert.ok(source.destination.routes.includes('/app/exchange'));
});
