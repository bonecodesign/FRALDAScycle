import assert from 'node:assert/strict';
import test from 'node:test';
import {exchangeDisputeAddendum} from '../packages/contracts/exchange-dispute-addendum.js';

test('dispute addendum stores an analysis reference only',()=>{
 assert.deepEqual(exchangeDisputeAddendum({analysisReference:'analysis:case:123'}),{analysisReference:'analysis:case:123'});
});

test('dispute addendum rejects absent, multiline or oversized references',()=>{
 for(const analysisReference of ['', 'a\nb', 'x'.repeat(201)])assert.throws(()=>exchangeDisputeAddendum({analysisReference}),/invalid_exchange_dispute_addendum/);
});
