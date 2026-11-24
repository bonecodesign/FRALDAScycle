import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createAsaasWebhookService } from '../apps/api/asaas-webhook-service.js';
import { cancelExpiredPremiumRenewals,reconcileAsaasInbox } from '../workers/asaas-reconciliation.js';

const raw=Buffer.from(JSON.stringify({id:'evt-1',event:'PAYMENT_RECEIVED',payment:{id:'pay-1'}}));
test('native event is authenticated, reduced and persisted without raw financial payload',async()=>{let stored;const service=createAsaasWebhookService({register:async value=>{stored=value;return{duplicate:false};}},{accessToken:'webhook-secret'});assert.deepEqual(await service.receive({raw,providedToken:'webhook-secret'}),{accepted:true,duplicate:false,reconciliationPending:true,financialTransitionAllowed:false});assert.deepEqual(stored,{eventId:'evt-1',eventType:'PAYMENT_RECEIVED',paymentId:'pay-1',candidate:'payment_receipt_candidate',payloadSha256:stored.payloadSha256});assert.match(stored.payloadSha256,/^[0-9a-f]{64}$/);assert.equal(JSON.stringify(stored).includes('webhook-secret'),false);});
test('reconciliation records matched evidence but performs zero financial transitions',async()=>{const finished=[];const repository={recover:async()=>1,acquire:async()=>[{event_id:'evt-1',payment_id:'pay-1',intent_id:'intent-1',reference:'intent-1',amount_cents:1234}],finish:async value=>finished.push(value)};const client={getPayment:async()=>({provider:'asaas',paymentId:'pay-1',reference:'intent-1',status:'RECEIVED',value:12.34})};assert.deepEqual(await reconcileAsaasInbox({repository,client}),{recovered:1,checked:1,reconciled:1,blocked:0,financialTransitions:0});assert.equal(finished[0].status,'reconciled');assert.equal(finished[0].evidence.matched,true);assert.equal(finished[0].evidence.financialTransitionAllowed,false);});
test('provider failure fails closed before an unmatched event can be classified',async()=>{const finished=[];const repository={recover:async()=>0,acquire:async()=>[{event_id:'missing',payment_id:'pay-x',intent_id:null},{event_id:'failure',payment_id:'pay-y',intent_id:'intent-y',reference:'intent-y',amount_cents:500}],finish:async value=>finished.push(value)};const client={getPayment:async()=>{throw Object.assign(new Error('synthetic'),{code:'asaas_unavailable'});}};assert.deepEqual(await reconcileAsaasInbox({repository,client}),{recovered:0,checked:2,reconciled:0,blocked:2,financialTransitions:0});assert.deepEqual(finished.map(item=>item.failureCode),['asaas_unavailable','asaas_unavailable']);});
test('reconciled Premium payment is the only path that grants a paid period',async()=>{const finished=[],applied=[];const repository={recover:async()=>0,acquire:async()=>[{event_id:'evt-premium',payment_id:'pay-premium',intent_id:null,payload_sha256:'a'.repeat(64)}],subscriptionContext:async()=>({id:'sub-local',user_id:'10000000-0000-4000-8000-000000000001',local_reference:'premium:local',amount_cents:1490}),activateSubscription:async id=>assert.equal(id,'sub-local'),finish:async value=>finished.push(value)};const client={getPayment:async()=>({provider:'asaas',paymentId:'pay-premium',reference:'premium:local',status:'RECEIVED',value:14.9,subscriptionId:'sub-provider',dueDate:'2030-01-02'})};const premiumBillingService={applyReconciled:async value=>applied.push(value)};assert.deepEqual(await reconcileAsaasInbox({repository,client,premiumBillingService}),{recovered:0,checked:1,reconciled:1,blocked:0,financialTransitions:1});assert.equal(applied[0].amountCents,1490);assert.equal(applied[0].paidPeriodStart,'2030-01-02T00:00:00.000Z');assert.equal(applied[0].paidPeriodEnd,'2030-02-02T00:00:00.000Z');assert.equal(finished[0].status,'reconciled');});
test('failed initial Premium payment enables manual retry without granting benefits',async()=>{let failedId,applied=false;const repository={recover:async()=>0,acquire:async()=>[{event_id:'evt-overdue',payment_id:'pay-overdue',intent_id:null,payload_sha256:'b'.repeat(64)}],subscriptionContext:async()=>({id:'sub-local',user_id:'10000000-0000-4000-8000-000000000001',local_reference:'premium:local',amount_cents:1490}),failSubscriptionPayment:async id=>{failedId=id;},finish:async()=>{}};const client={getPayment:async()=>({provider:'asaas',paymentId:'pay-overdue',reference:'premium:local',status:'OVERDUE',value:14.9,subscriptionId:'sub-provider',dueDate:'2030-01-02'})};const result=await reconcileAsaasInbox({repository,client,premiumBillingService:{applyReconciled:async()=>{applied=true;}}});assert.equal(failedId,'sub-local');assert.equal(applied,false);assert.deepEqual(result,{recovered:0,checked:1,reconciled:0,blocked:1,financialTransitions:0});});
test('failed renewal records grace state without automatic retry',async()=>{let renewalId,applied;const repository={recover:async()=>0,acquire:async()=>[{event_id:'evt-renewal',payment_id:'pay-renewal',intent_id:null,payload_sha256:'c'.repeat(64)}],subscriptionContext:async()=>({id:'sub-local',user_id:'10000000-0000-4000-8000-000000000001',local_reference:'premium:local',amount_cents:1490,status:'active'}),failSubscriptionRenewal:async id=>{renewalId=id;},finish:async()=>{}};const client={getPayment:async()=>({provider:'asaas',paymentId:'pay-renewal',reference:'premium:local',status:'OVERDUE',value:14.9,subscriptionId:'sub-provider',dueDate:'2030-02-02'})};const result=await reconcileAsaasInbox({repository,client,premiumBillingService:{applyReconciled:async value=>{applied=value;}}});assert.equal(renewalId,'sub-local');assert.equal(applied.eventType,'renewal_failed');assert.equal(applied.amountCents,null);assert.deepEqual(result,{recovered:0,checked:1,reconciled:1,blocked:0,financialTransitions:1});});
test('expired grace cancels provider recurrence without attempting another charge',async()=>{const finished=[],cancelled=[];const repository={acquireExpiredRenewals:async()=>[{id:'local-1',user_id:'user-1',provider_subscription_id:'sub-1'}],finishExpiredCancellation:async value=>finished.push(value)};const client={cancelSubscription:async id=>cancelled.push(id)};assert.deepEqual(await cancelExpiredPremiumRenewals({repository,client}),{checked:1,cancelled:1,failed:0,automaticChargeRetries:0});assert.deepEqual(cancelled,['sub-1']);assert.deepEqual(finished,[{id:'local-1',userId:'user-1',succeeded:true}]);});
test('provider cancellation failure is recoverable and never charges',async()=>{const finished=[];const repository={acquireExpiredRenewals:async()=>[{id:'local-1',user_id:'user-1',provider_subscription_id:'sub-1'}],finishExpiredCancellation:async value=>finished.push(value)};const client={cancelSubscription:async()=>{throw Object.assign(new Error('down'),{code:'asaas_unavailable'});}};assert.deepEqual(await cancelExpiredPremiumRenewals({repository,client}),{checked:1,cancelled:0,failed:1,automaticChargeRetries:0});assert.deepEqual(finished,[{id:'local-1',userId:'user-1',succeeded:false,failureCode:'asaas_unavailable'}]);});
test('inbox schema and repository cannot mutate payment or transaction state',async()=>{const [migration,repository]=await Promise.all([readFile(new URL('../database/migrations/073_asaas_webhook_inbox.sql',import.meta.url),'utf8'),readFile(new URL('../database/asaas-webhook-repository.js',import.meta.url),'utf8')]);assert.match(migration,/financial activation is approved/);assert.doesNotMatch(repository,/UPDATE\s+(payment_intents|transactions)/i);assert.match(repository,/ON CONFLICT\(event_id\) DO NOTHING/);assert.match(repository,/SKIP LOCKED/);});


test('FC-370: mismatched Premium payment evidence cannot activate benefits, alter grace or fail a subscription',async()=>{
  const baseline={provider:'asaas',paymentId:'pay-premium',reference:'premium:local',status:'RECEIVED',value:14.9,subscriptionId:'sub-provider',dueDate:'2030-01-02'};
  for(const state of ['provider_pending','active','renewal_failed']){
    for(const status of ['RECEIVED','CONFIRMED','OVERDUE','REFUNDED','CHARGEBACK_REQUESTED']){
      for(const mismatch of [{reference:'premium:other'},{value:14.91},{value:14.901}]){
        const finished=[],effects=[];
        const repository={recover:async()=>0,acquire:async()=>[{event_id:'evt-premium',payment_id:'pay-premium',intent_id:null,payload_sha256:'a'.repeat(64)}],
          subscriptionContext:async()=>({id:'sub-local',user_id:'user-local',local_reference:'premium:local',amount_cents:1490,status:state}),
          activateSubscription:async()=>effects.push('activate'),failSubscriptionPayment:async()=>effects.push('fail-initial'),
          failSubscriptionRenewal:async()=>effects.push('fail-renewal'),finish:async value=>finished.push(value)};
        const result=await reconcileAsaasInbox({repository,client:{getPayment:async()=>({...baseline,status,...mismatch})},
          premiumBillingService:{applyReconciled:async()=>effects.push('billing')}});
        assert.deepEqual(effects,[],JSON.stringify({state,status,mismatch}));
        assert.deepEqual(result,{recovered:0,checked:1,reconciled:0,blocked:1,financialTransitions:0});
        assert.equal(finished.length,1);
        assert.equal(finished[0].evidence.matched,false);
        assert.equal(finished[0].evidence.financialTransitionAllowed,false);
        assert.ok(finished[0].evidence.blockers.some(x=>['reference_mismatch','amount_mismatch','provider_amount_invalid'].includes(x)));
      }
    }
  }
});

test('FC-370: wrong payment identity or provider is blocked before subscription lookup or any mutation',async()=>{
  for(const intent_id of [null,'intent-local']){
    for(const change of [{paymentId:'pay-other'},{paymentId:null},{provider:'other'}]){
      const finished=[],effects=[];
      const repository={recover:async()=>0,acquire:async()=>[{event_id:'evt-local',payment_id:'pay-local',intent_id,reference:'premium:local',amount_cents:1490}],
        subscriptionContext:async()=>effects.push('lookup'),activateSubscription:async()=>effects.push('activate'),
        failSubscriptionPayment:async()=>effects.push('fail'),failSubscriptionRenewal:async()=>effects.push('renewal'),
        finish:async value=>finished.push(value)};
      const result=await reconcileAsaasInbox({repository,client:{getPayment:async()=>({provider:'asaas',paymentId:'pay-local',reference:'premium:local',status:'RECEIVED',value:14.9,subscriptionId:'sub-provider',...change})},
        premiumBillingService:{applyReconciled:async()=>effects.push('billing')}});
      assert.deepEqual(effects,[]);
      assert.deepEqual(result,{recovered:0,checked:1,reconciled:0,blocked:1,financialTransitions:0});
      assert.equal(finished[0].failureCode,'provider_payment_identity_mismatch');
      assert.equal(finished[0].evidence.paymentId,'pay-local');
      assert.equal(finished[0].evidence.financialTransitionAllowed,false);
    }
  }
});
