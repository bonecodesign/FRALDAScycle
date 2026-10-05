import test from 'node:test';
import assert from 'node:assert/strict';
import { createModerationService } from '../apps/api/moderation-service.js';
import { assertContentAllowed } from '../apps/api/content-guard.js';
const id='10000000-0000-4000-8000-000000000001';
test('moderation review and sanction require permission before accessing persistence',()=>{
  const service=createModerationService({reviewAppeal:()=>assert.fail(),suspend:()=>assert.fail()});
  for(const role of ['customer','courier']){
    assert.throws(()=>service.reviewAppeal({id,role},id,{confirmed:true,outcome:'overturned',reason:'Motivo fictício suficiente.'}),e=>e.code==='forbidden');
    assert.throws(()=>service.suspend({id,role},{}),e=>e.code==='forbidden');
  }
});
test('appeal does not accept another account identity or missing explanation',()=>{
  const service=createModerationService({appeal:()=>assert.fail()});
  for(const input of [{body:'curto'},{body:'Motivo fictício suficiente.',userId:id},null])assert.throws(()=>service.appeal({id,role:'customer'},id,input),e=>e.status===422);
});
test('content rejection stores only fingerprint and categories, with a private appeal reference',async()=>{
  let record;
  const repository={async exception(){return false;},async recordBlocked(input){record=input;return {id};}};
  await assert.rejects(assertContentAllowed(repository,id,'listing','Contato fictício fake@example.test'),e=>e.code==='content_requires_moderation'&&e.message.includes(id));
  assert.equal(record.hash.length,64);assert.ok(record.reasons.includes('email'));assert.equal(record.ruleVersion,'FC-CONTENT-1');
  assert.ok(!JSON.stringify(record).includes('fake@example.test'));assert.ok(!Object.hasOwn(record,'text'));
});
test('reviewed exception is bounded by repository context, not supplied by the caller',async()=>{
  let context;
  await assertContentAllowed({async exception(input){context=input;return true;},recordBlocked:()=>assert.fail()},id,'chat','Lote 12345678',id);
  assert.equal(context.userId,id);assert.equal(context.transactionId,id);assert.equal(context.surface,'chat');
});
