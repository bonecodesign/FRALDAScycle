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

test('graduated sanction proposal and review require exact independent levels without applying effects',async()=>{
  const calls=[],service=createModerationService({async proposeSanction(input){calls.push(['propose',input]);return{id};},async reviewSanction(input){calls.push(['review',input]);return{id,status:'level4_approved'};}}),level3={id:'level3',role:'admin',staffSector:'moderation',staffAccessLevel:3},level4={id:'level4',role:'admin',staffSector:'moderation',staffAccessLevel:4};
  const proposal=await service.proposeSanction(level3,{userId:id,action:'permanent_block',until:null,reason:'Reincidência crítica documentada para análise graduada.',confirmed:true});assert.equal(proposal.id,id);
  const review=await service.reviewSanction(level4,id,{action:'temporary_suspension',until:new Date(Date.now()+86400000).toISOString(),reason:'Revisão reduziu a medida para suspensão temporária proporcional.',confirmed:true});assert.equal(review.status,'level4_approved');
  assert.deepEqual(calls.map(x=>x[0]),['propose','review']);
  assert.throws(()=>service.proposeSanction(level4,{userId:id,action:'warning',until:null,reason:'Tentativa em nível incorreto.',confirmed:true}),error=>error.code==='forbidden');
  assert.throws(()=>service.reviewSanction(level3,id,{action:'warning',until:null,reason:'Tentativa em nível incorreto.',confirmed:true}),error=>error.code==='forbidden');
});

test('temporary suspension is the only proposed sanction that accepts an expiry',async()=>{
  const service=createModerationService({proposeSanction:()=>assert.fail()}),actor={id:'level3',role:'admin',staffSector:'moderation',staffAccessLevel:3},future=new Date(Date.now()+86400000).toISOString();
  for(const input of [
    {userId:id,action:'temporary_suspension',until:null,reason:'Suspensão sem prazo não deve ser aceita.',confirmed:true},
    {userId:id,action:'warning',until:future,reason:'Advertência não recebe prazo de suspensão.',confirmed:true},
    {userId:id,action:'permanent_block',until:null,reason:'Confirmação ausente não pode criar proposta.',confirmed:false},
  ])assert.throws(()=>service.proposeSanction(actor,input),error=>error.code==='invalid_moderation_sanction');
});
