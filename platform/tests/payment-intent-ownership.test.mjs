import assert from 'node:assert/strict';
import test from 'node:test';
import {createPaymentService} from '../apps/api/payment-service.js';
import {createPaymentRepository} from '../database/payment-repository.js';
const tx='11111111-1111-4111-8111-111111111111';
const input={transactionId:tx,idempotencyKey:'synthetic-payment-key-001',method:'pix',walletAmountCents:0};
const prior={id:'intent',transaction_id:tx,buyer_id:'buyer',method:'pix',wallet_amount_cents:0,status:'pending'};
test('FC-413: existing payment lookup binds buyer and transaction before exposing checkout',async()=>{
  const calls=[];const repo=createPaymentRepository({transaction:async fn=>fn({async query(sql,args){calls.push({sql,args});return{rows:[prior]}}})});
  const result=await repo.context({buyerId:'buyer',transactionId:tx,idempotencyKey:input.idempotencyKey});
  assert.equal(result.existing,true);assert.deepEqual(calls[0].args,[input.idempotencyKey,tx,'buyer']);
  assert.match(calls[0].sql,/p\.idempotency_key=\$1 AND p\.transaction_id=\$2 AND p\.buyer_id=\$3 AND t\.buyer_id=\$3/);
});
test('FC-413: existing intent is reused only for same buyer, purchase, method and wallet amount',async()=>{
  let providerCalls=0;const service=row=>createPaymentService({async context(){return{existing:true,intent:row}}},{async createIntent(){providerCalls++}});
  assert.equal((await service(prior).createIntent('buyer',input)).reused,true);
  for(const row of [{...prior,buyer_id:'other'},{...prior,transaction_id:'other'},{...prior,method:'wallet'},{...prior,wallet_amount_cents:1}]){
    await assert.rejects(service(row).createIntent('buyer',input),e=>e.code==='payment_attempt_conflict'&&e.status===409);
  }
  assert.equal(providerCalls,0);
});
test('FC-413: prior attempt after acquiring row lock prevents all financial side effects',async()=>{
  const calls=[];const repo=createPaymentRepository({transaction:async fn=>fn({async query(sql){calls.push(sql);return{rows:[{id:'prior'}]}}})});
  await assert.rejects(repo.createIntent({...input,buyerId:'buyer'}),e=>e.code==='payment_attempt_conflict');
  assert.equal(calls.length,2);assert.match(calls[0],/FOR UPDATE/);assert.match(calls[1],/SELECT id FROM payment_intents/);
});
test('FC-413: global key conflict at INSERT fails without updating a foreign row or reserving funds',async()=>{
  const calls=[];const repo=createPaymentRepository({transaction:async fn=>fn({async query(sql){calls.push(sql);return{rows:calls.length===1?[{id:tx}]:[]}}})});
  await assert.rejects(repo.createIntent({...input,buyerId:'buyer'}),e=>e.code==='payment_attempt_conflict');
  assert.equal(calls.length,3);assert.match(calls[2],/ON CONFLICT \(idempotency_key\) DO NOTHING/);
  assert.doesNotMatch(calls.join('\n'),/UPDATE courier_wallet_accounts|INSERT INTO audit_events/);
});
