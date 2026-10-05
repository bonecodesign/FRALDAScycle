import assert from 'node:assert/strict';
import test from 'node:test';
import {createPrivacyRequestService} from '../apps/api/privacy-request-service.js';
const input={kind:'deletion',details:'Solicitação fictícia de exclusão da conta.',confirmed:true,idempotencyKey:'synthetic-privacy-request'};
test('privacy request uses session identity and does not accept erasure authorization',()=>{
  const service=createPrivacyRequestService({create(v){return v;}});
  assert.throws(()=>service.create({id:'own'},{...input,userId:'foreign'}),e=>e.code==='invalid_privacy_request');
  assert.throws(()=>service.create({id:'own'},{...input,erasureAllowed:true}),e=>e.code==='invalid_privacy_request');
  assert.throws(()=>service.create({id:'own'},{...input,confirmed:false}),e=>e.code==='privacy_confirmation_required');
  assert.equal(service.create({id:'own'},input).actorId,'own');
});
test('privacy assessment requires authorized scope, version and explicit confirmation',()=>{
  const service=createPrivacyRequestService({assess(v){return v;},list(v){return v;}});
  assert.throws(()=>service.assess({id:'mod',role:'moderator'},'id',null),e=>e.status===403);
  assert.equal(service.list({id:'own',role:'customer'}).reviewer,false);
  assert.throws(()=>service.assess({id:'admin',role:'admin'},'id',{expectedVersion:0,reason:input.details,confirmed:false}),e=>e.code==='invalid_privacy_assessment');
  assert.equal(service.assess({id:'admin',role:'admin'},'id',{expectedVersion:0,reason:input.details,confirmed:true}).expectedVersion,0);
});
