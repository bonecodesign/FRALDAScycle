import assert from 'node:assert/strict';
import test from 'node:test';
import {exchangeDisputeEvidence} from '../packages/contracts/exchange-dispute-evidence.js';

const complete={deliveryProofReference:'proof:123',supportHistoryReference:'ticket:123',paymentStatusReference:'payment:123',logisticsStatusReference:'shipment:123',requesterStatementReference:'statement:requester:123',ownerStatementReference:'statement:owner:123'};

test('complete dispute evidence checklist keeps references only',()=>{
 assert.deepEqual(exchangeDisputeEvidence(complete),complete);
});

test('missing, multiline or oversized evidence references fail closed',()=>{
 for(const value of ['', 'a\nb', 'x'.repeat(201)])assert.throws(()=>exchangeDisputeEvidence({...complete,logisticsStatusReference:value}),/invalid_exchange_dispute_evidence/);
});
