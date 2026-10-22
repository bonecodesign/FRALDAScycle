import assert from 'node:assert/strict';
import test from 'node:test';
import {createAddressChangeService} from '../apps/api/address-change-service.js';
const id='11111111-1111-4111-8111-111111111111';
const input={shareId:id,addressId:id,expectedRevision:0,confirmed:true,noticeVersion:'FC-ADDRESS-1',reason:'Solicitação sintética de correção.',idempotencyKey:'synthetic-address-key-01'};
test('address change binds identity to session and requires versioned explicit consent',()=>{
  let captured;const s=createAddressChangeService({request(v){captured=v;return v;}});
  assert.throws(()=>s.request({id:'owner'},{...input,confirmed:false}),e=>e.code==='address_consent_required');
  assert.throws(()=>s.request({id:'owner'},{...input,actorId:'other'}),e=>e.code==='invalid_address_change');
  assert.throws(()=>s.request({id:'owner'},{...input,expectedRevision:0.5}),e=>e.code==='invalid_address_change');
  s.request({id:'owner'},input);assert.equal(captured.actorId,'owner');assert.equal(captured.expectedRevision,0);
});
test('address change review requires support scope before reading payload',async()=>{
  const s=createAddressChangeService({review(v){return v;},list(v){return v;}});
  assert.throws(()=>s.review({id:'x',role:'moderator'},id,null),e=>e.status===403);
  assert.throws(()=>s.review({id:'x',role:'admin'},id,{confirmed:false,outcome:'approved',reason:input.reason}),e=>e.code==='invalid_address_review');
  assert.equal(s.list({id:'x',role:'customer'}).reviewer,false);
  assert.equal(s.list({id:'x',role:'admin'}).reviewer,true);
  assert.equal((await s.review({id:'x',role:'admin'},id,{confirmed:true,outcome:'rejected',reason:input.reason})).actorId,'x');
});

test('provider update gate remains a safe public service error',async()=>{
  const service=createAddressChangeService({async review(){throw Object.assign(new Error('A alteração junto ao fornecedor de entrega ainda não foi homologada.'),{code:'address_provider_update_not_configured',status:503});}});
  await assert.rejects(service.review({id:'reviewer',role:'admin'},id,{confirmed:true,outcome:'approved',reason:'Conferência registrada pelo suporte.'}),error=>
    error.code==='address_provider_update_not_configured'&&error.status===409);
});
