import assert from 'node:assert/strict';
import test from 'node:test';
import {processExchangeDisputeSettlements,runExchangeDisputeSettlement} from '../workers/exchange-dispute-settlement.js';

test('settlement worker passes stable idempotency key and completes a claimed command',async()=>{
 const calls=[];const repository={async claimDifferenceDisputeSettlements(){return[{id:'command',operation:'release',transaction_id:'transaction',idempotency_key:'exchange-dispute:123456'}];},async completeDifferenceDisputeSettlement(input){calls.push(input);},async requireDifferenceDisputeSettlementReconciliation(){assert.fail('unexpected reconciliation');}};
 const result=await processExchangeDisputeSettlements({repository,executor:async input=>{assert.equal(input.idempotencyKey,'exchange-dispute:123456');return{providerReference:'provider:123'};}});assert.deepEqual(result,{claimed:1,completed:1,reconciliationRequired:0});assert.deepEqual(calls,[{commandId:'command',providerReference:'provider:123'}]);
});

test('uncertain provider result never retries automatically and requires reconciliation',async()=>{
 let failure;const repository={async claimDifferenceDisputeSettlements(){return[{id:'command',operation:'refund_full',transaction_id:'transaction',idempotency_key:'exchange-dispute:123456'}];},async completeDifferenceDisputeSettlement(){assert.fail('unexpected completion');},async requireDifferenceDisputeSettlementReconciliation(input){failure=input;}};
 const result=await processExchangeDisputeSettlements({repository,executor:async()=>{throw Object.assign(new Error('timeout'),{code:'provider_uncertain'});}});assert.equal(result.reconciliationRequired,1);assert.deepEqual(failure,{commandId:'command',failureCode:'provider_uncertain'});
});

test('settlement worker is fail-closed without flags, acknowledgement and adapter',async()=>{
 await assert.rejects(runExchangeDisputeSettlement({env:{NODE_ENV:'production'}}),/feature flag/);
 await assert.rejects(runExchangeDisputeSettlement({env:{NODE_ENV:'production',EXCHANGE_DISPUTE_SETTLEMENT_ENABLED:'true',EXCHANGE_DISPUTE_SETTLEMENT_ACTIVATION_ACKNOWLEDGED:'true'}}),/adaptador financeiro/);
});
