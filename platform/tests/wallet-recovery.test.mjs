import assert from 'node:assert/strict';
import test from 'node:test';
import {createPaymentService} from '../apps/api/payment-service.js';

const buyerId='buyer-1',transactionId='11111111-1111-4111-8111-111111111111';
const request={transactionId,idempotencyKey:'synthetic-wallet-recovery',method:'wallet',walletAmountCents:1000};
const prior={id:'intent-1',buyer_id:buyerId,transaction_id:transactionId,method:'wallet',amount_cents:1000,wallet_amount_cents:1000,provider_charge_cents:0,status:'provider_pending'};
function harness(intent){
  const calls=[];
  const service=createPaymentService({
    async context(){return{existing:true,intent};},
    async createIntent(){throw Error('Unexpected new intent');},
    async completeWalletPayment(input){calls.push(input);return {...intent,status:'paid'};}
  },{async createIntent(){throw Error('Unexpected external charge');}});
  return{service,calls};
}
test('FC-425: resume only the original fully local pending wallet payment',async()=>{
  const h=harness(prior);
  const result=await h.service.createIntent(buyerId,request);
  assert.equal(result.reused,true);assert.equal(result.intent.status,'paid');
  assert.deepEqual(h.calls,[{intentId:prior.id,buyerId,idempotencyKey:request.idempotencyKey}]);
});
test('FC-425: already paid, failed and external attempts are never resubmitted',async()=>{
  for(const intent of [{...prior,status:'paid'},{...prior,status:'failed'},{...prior,method:'pix',wallet_amount_cents:500,provider_charge_cents:500}]){
    const h=harness(intent);
    const result=await h.service.createIntent(buyerId,{...request,method:intent.method,walletAmountCents:intent.wallet_amount_cents});
    assert.equal(result.reused,true);assert.equal(result.intent.status,intent.status);assert.equal(h.calls.length,0);
  }
});
test('FC-425: ownership and original funding must match before recovery',async()=>{
  for(const [intent,input] of [[{...prior,buyer_id:'other'},request],[prior,{...request,walletAmountCents:500}],[prior,{...request,deliveryRequested:true}]]){
    const h=harness(intent);
    await assert.rejects(h.service.createIntent(buyerId,input),error=>error.code==='payment_attempt_conflict');
    assert.equal(h.calls.length,0);
  }
});
