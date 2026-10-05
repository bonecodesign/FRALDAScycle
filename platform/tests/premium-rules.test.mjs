import test from 'node:test';
import assert from 'node:assert/strict';
import { PREMIUM_MONTHLY_CENTS, FREE_LISTING_LIMIT, premiumEntitlement, cancelPremiumRenewal, freeListingPlan } from '../packages/contracts/premium-rules.js';

const paid = () => ({ paidPeriodStart: '2026-09-05T12:00:00Z', paidPeriodEnd: '2026-10-05T12:00:00Z', renewalEnabled: true, renewalFailedAt: null });
const listing = (id, day, extra = {}) => ({ id, sellerId: 'user', status: 'published', publishedAt: `2026-10-0${day}T12:00:00Z`, ongoingTransaction: false, ...extra });
test('approved price, limit and free baseline never allow external billing', () => {
  assert.equal(PREMIUM_MONTHLY_CENTS, 1290);
  assert.equal(FREE_LISTING_LIMIT, 3);
  assert.equal(premiumEntitlement(null, '2026-10-05T12:00:00Z').state, 'free');
  assert.equal(premiumEntitlement(paid(), '2026-10-05T11:59:59Z').billingAllowed, false);
});
test('cancellation prevents next renewal and keeps benefits until the paid period ends', () => {
  const original = paid();
  const cancelled = cancelPremiumRenewal(original);
  assert.equal(original.renewalEnabled, true);
  assert.equal(cancelled.renewalEnabled, false);
  assert.deepEqual(cancelPremiumRenewal(cancelled), cancelled);
  assert.equal(premiumEntitlement(cancelled, '2026-10-05T11:59:59Z').state, 'active');
  assert.equal(premiumEntitlement(cancelled, '2026-10-05T12:00:00Z').state, 'free');
});
test('failed renewal retains benefits for exactly three consecutive days and never accumulates billing', () => {
  const subscription = { ...paid(), renewalFailedAt: '2026-10-05T12:00:00Z' };
  const grace = premiumEntitlement(subscription, '2026-10-05T12:00:00Z');
  assert.equal(grace.state, 'grace');
  assert.equal(grace.graceThrough, '2026-10-08T12:00:00.000Z');
  assert.equal(grace.billingAllowed, false);
  assert.equal(premiumEntitlement(subscription, '2026-10-08T11:59:59Z').benefitsActive, true);
  assert.equal(premiumEntitlement(subscription, '2026-10-08T12:00:00Z').state, 'free');
  assert.equal(premiumEntitlement(subscription, '2027-02-01T12:00:00Z').billingAllowed, false);
});
test('periods are explicit and February does not become a thirty-day month', () => {
  const subscription = { ...paid(), paidPeriodStart: '2027-02-01T12:00:00Z', paidPeriodEnd: '2027-03-01T12:00:00Z' };
  assert.equal(premiumEntitlement(subscription, '2027-03-01T11:59:59Z').state, 'active');
  assert.equal(premiumEntitlement(subscription, '2027-03-01T12:00:00Z').state, 'free');
});
test('invalid, ambiguous, early and future events fail rather than granting benefits', () => {
  for (const subscription of [
    { ...paid(), renewalEnabled: 'true' },
    { ...paid(), paidPeriodEnd: '2026-10-05' },
    { ...paid(), paidPeriodEnd: '2026-02-30T12:00:00Z' },
    { ...paid(), paidPeriodEnd: '2026-09-01T12:00:00Z' },
    { ...paid(), renewalFailedAt: '2026-10-04T12:00:00Z' },
    { ...paid(), renewalFailedAt: '2026-10-06T12:00:00Z' },
  ]) assert.throws(() => premiumEntitlement(subscription, '2026-10-05T12:00:00Z'));
});
test('recalculating a repeated failure does not restart the regularization deadline', () => {
  const subscription = { ...paid(), renewalFailedAt: '2026-10-05T12:00:00Z' };
  const first = premiumEntitlement(subscription, '2026-10-05T12:00:00Z');
  const later = premiumEntitlement(subscription, '2026-10-07T12:00:00Z');
  assert.equal(first.graceThrough, later.graceThrough);
  assert.equal(subscription.renewalFailedAt, '2026-10-05T12:00:00Z');
});
test('regularization requires a new explicit paid period rather than reusing the failure', () => {
  const subscription = { ...paid(), renewalFailedAt: '2026-10-05T12:00:00Z' };
  assert.equal(premiumEntitlement(subscription, '2026-10-08T12:00:00Z').state, 'free');
  const renewed = { ...paid(), paidPeriodStart: '2026-10-05T12:00:00Z', paidPeriodEnd: '2026-11-05T12:00:00Z' };
  assert.equal(premiumEntitlement(renewed, '2026-10-08T12:00:00Z').state, 'active');
});
test('without a choice, the three most recently published listings are kept', () => {
  const listings = [listing('one', 1), listing('two', 2), listing('three', 3), listing('four', 4), listing('five', 5)];
  const snapshot = structuredClone(listings);
  const result = freeListingPlan({ userId: 'user', listings });
  assert.deepEqual(result.keepIds, ['five', 'four', 'three']);
  assert.deepEqual(result.pauseIds.sort(), ['one', 'two']);
  assert.deepEqual(listings, snapshot);
});
test('explicit choice and empty choice are preserved without silently replacing them', () => {
  const listings = [listing('one', 1), listing('two', 2), listing('three', 3), listing('four', 4)];
  assert.deepEqual(freeListingPlan({ userId: 'user', listings, selectedIds: ['one', 'two'] }).keepIds, ['one', 'two']);
  assert.equal(freeListingPlan({ userId: 'user', listings, selectedIds: [] }).pauseIds.length, 4);
});
test('transactions in progress and non-public listings are preserved regardless of publication time', () => {
  const listings = [listing('one', 1), listing('two', 2), listing('three', 3), listing('four', 4), listing('ongoing', 1, { ongoingTransaction: true }), listing('unavailable', 1, { status: 'unavailable' }), listing('paused', 1, { status: 'paused' })];
  const result = freeListingPlan({ userId: 'user', listings });
  assert.deepEqual(result.preservedIds, ['ongoing', 'unavailable', 'paused']);
  assert.deepEqual(result.pauseIds, ['one']);
});
test('other accounts, duplicate choices, surplus choices and unknown transaction state are rejected', () => {
  const listings = [listing('one', 1), listing('two', 2), listing('three', 3), listing('four', 4)];
  for (const selectedIds of [['other'], ['one', 'one'], ['one', 'two', 'three', 'four']]) assert.throws(() => freeListingPlan({ userId: 'user', listings, selectedIds }));
  assert.throws(() => freeListingPlan({ userId: 'other', listings }));
  assert.throws(() => freeListingPlan({ userId: 'user', listings: [listing('one', 1, { ongoingTransaction: undefined })] }));
  assert.throws(() => freeListingPlan({ userId: 'user', listings: [listing('one', 1), listing('one', 2)] }));
});
