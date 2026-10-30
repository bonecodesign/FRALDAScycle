import assert from 'node:assert/strict';
import test from 'node:test';
import {createHmac} from 'node:crypto';
import {createPremiumSubscriptionService} from '../apps/api/premium-subscription-service.js';
const userId='10000000-0000-4000-8000-000000000001',cpf='52998224725',secret='s'.repeat(32);
const account={legal_name:'Ana Silva',email:'ana@example.com',cpf_fingerprint:createHmac('sha256',secret).update(cpf).digest()};
test('Premium creates R$14.90 monthly tokenized recurrence but never grants benefits from create response',async()=>{
  let attached,remote;
  const repository={reserve:async()=>({reused:false,subscription:{id:'20000000-0000-4000-8000-000000000001'},account}),attach:async value=>{attached=value;},fail:async()=>assert.fail('unexpected failure')};
  const client={createCustomer:async()=>({customerId:'cus_1'}),createCreditCardSubscription:async value=>(remote=value,{subscriptionId:'sub_1'})};
  const service=createPremiumSubscriptionService(repository,client,{cpfHmacSecret:secret,clock:()=>Date.parse('2030-01-02T10:00:00Z')});
  const result=await service.subscribe(userId,{paymentMethodToken:'provider-token',billingCpf:cpf,idempotencyKey:'premium-request-0001'});
  assert.equal(remote.amountCents,1490);assert.equal(remote.nextDueDate,'2030-01-02');assert.equal(remote.creditCardToken,'provider-token');assert.equal(remote.cycle,undefined);
  assert.deepEqual(attached,{id:'20000000-0000-4000-8000-000000000001',customerId:'cus_1',subscriptionId:'sub_1'});
  assert.deepEqual(result,{reused:false,status:'provider_pending',benefitsActivatedByRequest:false});
});
test('Premium rejects raw card fields before persistence',async()=>{const service=createPremiumSubscriptionService({reserve:()=>assert.fail('persisted')},{},{cpfHmacSecret:secret});await assert.rejects(service.subscribe(userId,{cardNumber:'1'}),e=>e.code==='raw_card_data_forbidden');});
test('manual retry cancels the failed provider recurrence before creating a new tokenized attempt',async()=>{const events=[];const repository={retryContext:async()=>({id:'old-local',provider_subscription_id:'sub_old'}),cancelled:async value=>{events.push(['cancelled-local',value]);return{id:'old-local'};},reserve:async()=>({reused:false,subscription:{id:'new-local'},account}),attach:async()=>{},fail:async()=>{}};const client={cancelSubscription:async id=>events.push(['cancelled-provider',id]),createCustomer:async()=>({customerId:'cus_1'}),createCreditCardSubscription:async()=>({subscriptionId:'sub_new'})};const service=createPremiumSubscriptionService(repository,client,{cpfHmacSecret:secret,clock:()=>Date.parse('2030-01-02T00:00:00Z')});const result=await service.subscribe(userId,{paymentMethodToken:'new-provider-token',billingCpf:cpf,idempotencyKey:'premium-retry-00001'});assert.deepEqual(events,[['cancelled-provider','sub_old'],['cancelled-local',{userId,id:'old-local',allowPaymentFailed:true}]]);assert.equal(result.status,'provider_pending');});
