import assert from 'node:assert/strict';
import test from 'node:test';
import {createChildProfileResponsibilityService} from '../apps/api/child-profile-responsibility-service.js';
import {loadConfig} from '../apps/api/config.js';
const id='11111111-1111-4111-8111-111111111111',profile='22222222-2222-4222-8222-222222222222',ticket='33333333-3333-4333-8333-333333333333';
const actor=level=>({id,role:'admin',staffAccessLevel:level});
test('family responsibility workflow is disabled by default',async()=>{await assert.rejects(createChildProfileResponsibilityService({}).list(actor(5)),error=>error.code==='family_responsibility_disputes_disabled');});
test('production requires child profiles and an independent responsibility acknowledgement',()=>{
 assert.equal(loadConfig({NODE_ENV:'test'}).familyResponsibilityDisputesEnabled,false);
 assert.throws(()=>loadConfig({NODE_ENV:'test',FAMILY_RESPONSIBILITY_DISPUTES_ENABLED:'true'}),/requires CHILD_PROFILES_ENABLED/);
 const production={NODE_ENV:'production',DATABASE_URL:'postgres://fixture',SESSION_SECRET:'s'.repeat(32),NOTIFICATION_WEBHOOK_URL:'https://notify.example.test',NOTIFICATION_WEBHOOK_SECRET:'synthetic',CHILD_PROFILES_ENABLED:'true',CHILD_PROFILES_ACTIVATION_ACKNOWLEDGED:'true',FAMILY_RESPONSIBILITY_DISPUTES_ENABLED:'true'};
 assert.throws(()=>loadConfig(production),/FAMILY_RESPONSIBILITY_DISPUTES_ACTIVATION_ACKNOWLEDGED=true/);
 assert.equal(loadConfig({...production,FAMILY_RESPONSIBILITY_DISPUTES_ACTIVATION_ACKNOWLEDGED:'true'}).familyResponsibilityDisputesEnabled,true);
});
test('responsibility workflow preserves exact levels and suspends only after plausibility',async()=>{
 const calls=[],repository={async list(){return[];},async open(input){calls.push(['open',input]);return{id,status:'submitted'};},async verify(input){calls.push(['verify',input]);return{id,status:input.plausible?'verified':'rejected'};},async decide(input){calls.push(['decide',input]);return{id,status:'resolved',outcome:input.outcome};}};
 const service=createChildProfileResponsibilityService(repository,{enabled:true});
 await assert.rejects(service.open(actor(2),{}),error=>error.code==='insufficient_access_level');
 const opened=await service.open(actor(1),{profileId:profile,supportTicketId:ticket,reasonCode:'responsibility_contested',evidenceReference:'evidence:opaque_123456'});assert.equal(opened.profileSuspended,false);
 await assert.rejects(service.verify(actor(1),id,{plausible:true,note:'Verificação suficiente registrada.'}),error=>error.code==='insufficient_access_level');
 const verified=await service.verify(actor(2),id,{plausible:true,note:'Verificação suficiente registrada.'});assert.equal(verified.profileSuspended,true);
 await assert.rejects(service.decide(actor(4),id,{outcome:'restore',note:'Decisão registrada após análise.'}),error=>error.code==='insufficient_access_level');
 const decided=await service.decide(actor(3),id,{outcome:'restore',note:'Decisão registrada após análise.'});assert.equal(decided.evidenceDeleteWithinDays,30);assert.deepEqual(calls.map(call=>call[0]),['open','verify','decide']);
});
