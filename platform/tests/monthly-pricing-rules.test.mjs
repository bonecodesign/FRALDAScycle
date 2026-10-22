import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LISTING_LIFETIME_DAYS, PRM_CEILING_BASIS_POINTS, effectivePriceCeiling,
  productEconomyBasisPoints, listingExpiry, monthlyReferenceWindow, priceAdjustmentRequired,
} from '../packages/contracts/monthly-pricing-rules.js';

test('monthly pricing constants preserve approved listing and PRM rules', () => {
  assert.equal(LISTING_LIFETIME_DAYS, 30);
  assert.equal(PRM_CEILING_BASIS_POINTS, 9999);
});

test('effective ceiling uses the stricter of 99.99% PRM and lowest trustworthy retail', () => {
  assert.equal(effectivePriceCeiling({ prmCents: 10000, lowestRetailCents: 9290 }), 9290);
  assert.equal(effectivePriceCeiling({ prmCents: 10000, lowestRetailCents: 12000 }), 9999);
});

test('price adjustment pauses only prices above the current effective ceiling', () => {
  assert.deepEqual(priceAdjustmentRequired({ listingPriceCents: 9290, prmCents: 10000, lowestRetailCents: 9290 }), { required: false, ceilingCents: 9290 });
  assert.deepEqual(priceAdjustmentRequired({ listingPriceCents: 9291, prmCents: 10000, lowestRetailCents: 9290 }), { required: true, ceilingCents: 9290 });
});

test('product economy is measured against PRM', () => {
  assert.equal(productEconomyBasisPoints({ prmCents: 10000, listingPriceCents: 7000 }), 3000);
});

test('listing lifetime is exactly thirty elapsed days and price changes do not participate', () => {
  assert.equal(listingExpiry('2026-11-10T12:00:00Z'), '2026-12-10T12:00:00.000Z');
});

test('reference window always runs from first day to first day of next month', () => {
  assert.deepEqual(monthlyReferenceWindow(2026, 11), { validFrom: '2026-11-01', validUntil: '2026-12-01' });
  assert.deepEqual(monthlyReferenceWindow(2026, 12), { validFrom: '2026-12-01', validUntil: '2027-01-01' });
});
