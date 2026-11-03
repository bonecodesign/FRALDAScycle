import assert from 'node:assert/strict';
import test from 'node:test';
import {createUserContentRetentionService} from '../apps/api/user-content-retention-service.js';
const listingId='11111111-1111-4111-8111-111111111111',holdId='22222222-2222-4222-8222-222222222222';
const actor=level=>({id:`${level}1111111-1111-4111-8111-111111111111`,role:'admin',staffAccessLevel:level});
test('content hold follows exact levels 3, 4 and 5 without restoring public access',async()=>{
 const calls=[],repository={async request(input){calls.push(['request',input]);return{id:holdId,status:'pending_level4'};},async decide(input){calls.push(['decide',input]);return{id:holdId,status:input.stage==='level5'?'active':'pending_level5'};},async list(){return[];}};
 const service=createUserContentRetentionService(repository,{enabled:true,clock:()=>new Date('2030-01-01T00:00:00Z')});
 await assert.rejects(service.request(actor(2),{}),error=>error.code==='insufficient_access_level');
 const requested=await service.request(actor(3),{listingId,caseReference:'CASE-TEST-1',justification:'Disputa formal sintética requer preservação.',expiresAt:'2030-02-01T00:00:00Z'});assert.equal(requested.contentPublic,false);assert.equal(requested.retentionActive,false);
 await assert.rejects(service.decide(actor(5),holdId,{stage:'level4',approved:true,note:'Tentativa fora do nível correto.'}),error=>error.code==='insufficient_access_level');
 assert.equal((await service.decide(actor(4),holdId,{stage:'level4',approved:true,note:'Nível quatro aprovou o prazo.'})).retentionActive,false);
 const final=await service.decide(actor(5),holdId,{stage:'level5',approved:true,note:'Fundador autorizou por último.'});assert.equal(final.retentionActive,true);assert.equal(final.contentPublic,false);
 assert.deepEqual(calls.map(([name])=>name),['request','decide','decide']);
});
test('content retention remains disabled by default and rejects expired requests',async()=>{
 await assert.rejects(createUserContentRetentionService({}).list(actor(5)),error=>error.code==='content_retention_disabled');
 const service=createUserContentRetentionService({request:async()=>({})},{enabled:true,clock:()=>new Date('2030-01-01T00:00:00Z')});
 await assert.rejects(service.request(actor(3),{listingId,caseReference:'CASE-1',justification:'Justificativa sintética suficiente.',expiresAt:'2029-12-31T00:00:00Z'}),error=>error.code==='invalid_content_retention_expiry');
});
