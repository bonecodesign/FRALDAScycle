import assert from 'node:assert/strict';
import test from 'node:test';
import {createPaymentService} from '../apps/api/payment-service.js';
import {createPaymentRepository} from '../database/payment-repository.js';
const id='22222222-2222-4222-8222-222222222222';
const input={idempotencyKey:'synthetic-case-key-001',reason:'not_received',details:'Descrição sintética de contestação.'};
const prior={id:'case-1',payment_intent_id:id,requester_id:'buyer',kind:'dispute',reason:input.reason,details:input.details,status:'submitted',provider_reference:'never-return'};
const createInput={...input,intentId:id,requesterId:'buyer',kind:'dispute',expectedProviderReference:'remote-1',expectedAmountCents:4000};
const locked={id,status:'paid',provider_reference:'remote-1',amount_cents:4000,wallet_amount_cents:0,provider_charge_cents:4000};
function harness(results){
  const calls=[];const repo=createPaymentRepository({transaction:async fn=>fn({async query(sql,args){calls.push({sql,args});return{rows:results[calls.length-1]??[]}}})});
  return{repo,calls};
}
test('FC-415: case key lookup requires matching requester and both payment and transaction buyer',async()=>{
  const h=harness([[prior]]);
  await h.repo.caseContext({requesterId:'buyer',intentId:id,idempotencyKey:input.idempotencyKey});
  assert.deepEqual(h.calls[0].args,[input.idempotencyKey,id,'buyer']);
  assert.match(h.calls[0].sql,/c\.payment_intent_id=\$2 AND c\.requester_id=\$3/);
  assert.match(h.calls[0].sql,/p\.buyer_id=\$3 AND t\.buyer_id=\$3/);
});
test('FC-415: reuse requires same owner and request, with minimal response',async()=>{
  let external=0;const service=row=>createPaymentService({async caseContext(){return{existing:true,paymentCase:row}}},{async createCase(){external++}});
  assert.deepEqual(await service(prior).createCase('buyer',id,'dispute',input),{paymentCase:{id:'case-1',status:'submitted'},reused:true});
  for(const row of [{...prior,requester_id:'other'},{...prior,payment_intent_id:'other'},{...prior,kind:'refund'},{...prior,reason:'other'},{...prior,details:'Other text'}]){
    await assert.rejects(service(row).createCase('buyer',id,'dispute',input),e=>e.code==='payment_case_conflict');
  }
  assert.equal(external,0);
});
test('FC-415: ownership and status are rechecked under row lock before insertion',async()=>{
  for(const [rows,code] of [[[],'payment_not_found'],[[{...locked,status:'refunded'}],'payment_case_conflict'],[[{...locked,amount_cents:5000,provider_charge_cents:5000}],'payment_case_conflict']]){
    const h=harness([rows]);await assert.rejects(h.repo.createCase(createInput),e=>e.code===code);assert.equal(h.calls.length,1);
    assert.match(h.calls[0].sql,/p\.buyer_id=\$2 AND t\.buyer_id=\$2 FOR UPDATE OF p/);
  }
});
test('FC-415: existing same-kind case or global key conflict stops before audit/provider',async()=>{
  const h=harness([[locked],[prior]]);await assert.rejects(h.repo.createCase(createInput),e=>e.code==='payment_case_conflict');assert.equal(h.calls.length,2);
  const collision=harness([[locked],[],[]]);await assert.rejects(collision.repo.createCase(createInput),e=>e.code==='payment_case_conflict');assert.equal(collision.calls.length,3);
  assert.match(collision.calls[2].sql,/ON CONFLICT \(idempotency_key\) DO NOTHING/);
  assert.doesNotMatch(collision.calls.map(c=>c.sql).join('\n'),/INSERT INTO audit_events/);
});

test('FC-416: direct cases refuse mixed, wallet-only or inconsistent funding before any provider call',async()=>{
  let creates=0,external=0;
  for(const funding of [
    {wallet_amount_cents:1000,provider_charge_cents:3000},
    {wallet_amount_cents:4000,provider_charge_cents:0},
    {wallet_amount_cents:0,provider_charge_cents:3000},
    {wallet_amount_cents:undefined,provider_charge_cents:4000},
  ]){
    for(const kind of ['refund','dispute']){
      const service=createPaymentService({async caseContext(){return{existing:false,intent:{...locked,...funding}}},async createCase(){creates++}},{async createCase(){external++}});
      await assert.rejects(service.createCase('buyer',id,kind,input),e=>e.code==='payment_case_requires_support'&&e.status===409);
      const h=harness([[{...locked,...funding}]]);
      await assert.rejects(h.repo.createCase({...createInput,kind}),e=>e.code==='payment_case_requires_support');
      assert.equal(h.calls.length,1);
    }
  }
  assert.equal(creates,0);assert.equal(external,0);
});
