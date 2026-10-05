import test from 'node:test';
import assert from 'node:assert/strict';
import { createPremiumService } from '../apps/api/premium-service.js';
const id = '10000000-0000-4000-8000-000000000001';
test('Premium never accepts account identity, grants or unconfirmed cancellation from the body', () => {
  const service = createPremiumService({ cancelRenewal: () => assert.fail('Unexpected persistence') });
  for (const input of [null, {}, { confirmed: false }, { confirmed: true, userId: id }, { confirmed: true, paid: true }]) {
    assert.throws(() => service.cancelRenewal(id, input), error => error.code === 'premium_confirmation_required');
  }
});
test('choice validates versions, owned identifiers at repository, distinct count and no injected benefits', () => {
  const service = createPremiumService({ saveChoice: (userId, input) => ({ userId, input }) });
  assert.equal(service.saveChoice(id, { selectedIds: [], expectedVersion: 0 }).userId, id);
  for (const input of [{selectedIds:[id,id],expectedVersion:0},{selectedIds:[id],expectedVersion:-1},{selectedIds:['bad'],expectedVersion:0},{selectedIds:[],expectedVersion:0,benefitsActive:true}]) {
    assert.throws(() => service.saveChoice(id,input), error => error.code === 'premium_invalid_choice');
  }
});
test('listing status permits only pause/resume and requires an observed publication state', () => {
  const service = createPremiumService({ changeListingStatus: (userId, input) => ({ userId, ...input }) });
  assert.equal(service.changeListingStatus(id,{listingId:id,status:'paused',expectedStatus:'published'}).status,'paused');
  for (const input of [{listingId:id,status:'published'},{listingId:id,status:'completed',expectedStatus:'published'},{listingId:id,status:'paused',expectedStatus:'published',userId:id}]) {
    assert.throws(() => service.changeListingStatus(id,input), error => error.code === 'invalid_listing_status');
  }
});
