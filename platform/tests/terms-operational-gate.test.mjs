import assert from 'node:assert/strict';
import test from 'node:test';
import { controlledDomain } from '../apps/api/operational-control.js';

test('terms gate perimeter maps new operations but preserves account and data-rights routes',()=>{
  assert.equal(controlledDomain('POST','/v1/listings'),'marketplace');
  assert.equal(controlledDomain('POST','/v1/payments/intents'),'payments');
  assert.equal(controlledDomain('POST','/v1/shipments'),'logistics');
  assert.equal(controlledDomain('POST','/v1/donations'),'donations');
  assert.equal(controlledDomain('PUT','/v1/account/premium/subscription'),'premium');
  for(const [method,path] of [['GET','/v1/account/terms'],['GET','/v1/account/terms/history'],['POST','/v1/account/terms/accept'],['GET','/v1/account/data-exports'],['POST','/v1/account/closure/request'],['GET','/v1/privacy-requests']])assert.equal(controlledDomain(method,path),null,`${method} ${path} must remain available`);
});
