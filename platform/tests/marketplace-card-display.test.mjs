import assert from 'node:assert/strict';
import test from 'node:test';
import { renderListingCard } from '../packages/contracts/marketplace-ui.js';

const listing = (overrides = {}) => ({
  id: 'listing-1', title: 'Fraldas M', kind: 'sale', status: 'published',
  package_condition: 'sealed', size: 'M', quantity: 24, price_cents: 4500,
  ...overrides,
});

test('shared Site and App cards show package condition and published status', () => {
  for (const surface of ['site', 'app']) {
    const html = renderListingCard(listing(), surface);
    assert.match(html, /Pacote fechado/);
    assert.match(html, /data-listing-status="published">Disponível/);
  }
});

test('open package is identified only for donations and unavailable/completed states are visible', () => {
  const donation = renderListingCard(listing({ kind: 'donation', package_condition: 'open', status: 'unavailable' }), 'site');
  assert.match(donation, /Pacote aberto/);
  assert.match(donation, /data-listing-status="unavailable">Indisponível/);

  const invalidSale = renderListingCard(listing({ package_condition: 'open' }), 'app');
  assert.match(invalidSale, /Condição não confirmada/);
  assert.doesNotMatch(invalidSale, /Pacote aberto/);

  const completed = renderListingCard(listing({ status: 'completed' }), 'site');
  assert.match(completed, /data-listing-status="completed">Finalizado/);
});
