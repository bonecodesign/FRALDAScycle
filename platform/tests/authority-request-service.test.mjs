import assert from 'node:assert/strict';
import test from 'node:test';
import {createAuthorityRequestService} from '../apps/api/authority-request-service.js';
import {loadConfig} from '../apps/api/config.js';

const id='11111111-1111-4111-8111-111111111111';
const actor=level=>({id:`${level}1111111-1111-4111-8111-111111111111`,role:'admin',staffAccessLevel:level});
const input={flow:'ordinary',authorityName:'Autoridade fictícia',authorityReference:'OFÍCIO-TESTE',scope:'Escopo mínimo fictício',legalBasis:'Fundamento legal fictício'};

test('ordinary authority flow enforces levels 1, 2 and 3',async()=>{
 const calls=[],repository={list:async()=>[],protocol:async value=>(calls.push(['protocol',value]),{id,status:'pending_validation'}),validate:async value=>(calls.push(['validate',value]),{id,status:'pending_authorization'}),decide:async value=>(calls.push(['decide',value]),{request:{id,status:'authorized'},disclosureAuthorized:true})};
 const service=createAuthorityRequestService(repository,{enabled:true});
 await assert.rejects(service.protocol({id:'customer',role:'customer'},input),error=>error.code==='insufficient_access_level');
 assert.equal((await service.protocol(actor(1),input)).disclosureAuthorized,false);
 await assert.rejects(service.validate(actor(1),id,{valid:true,note:'Identidade e competência verificadas.'}),error=>error.code==='insufficient_access_level');
 await service.validate(actor(2),id,{valid:true,note:'Identidade e competência verificadas.'});
 await assert.rejects(service.decide(actor(2),id,{stage:'authorize',approved:true,note:'Divulgação mínima autorizada.'}),error=>error.code==='insufficient_access_level');
 assert.equal((await service.decide(actor(3),id,{stage:'authorize',approved:true,note:'Divulgação mínima autorizada.'})).disclosureAuthorized,true);
 assert.deepEqual(calls.map(([name])=>name),['protocol','validate','decide']);
});

test('judicial exception requires sequential legal, level 4 and founder decisions',async()=>{
 const stages=[],repository={protocol:async value=>({id,flow:value.flow}),decide:async value=>(stages.push(value.stage),{request:{id,status:value.stage==='level5'?'authorized':'pending_exception_approval'},disclosureAuthorized:value.stage==='level5'}),list:async()=>[],validate:async()=>({id})};
 const service=createAuthorityRequestService(repository,{enabled:true});
 await service.protocol(actor(1),{...input,flow:'judicial_exception',judicialOrderReference:'ORDEM-JUDICIAL-TESTE'});
 await service.decide(actor(3),id,{stage:'legal',approved:true,note:'Ordem judicial formalmente validada.'});
 await service.decide(actor(3),id,{stage:'level3',approved:true,note:'Nível três autorizou a escalada excepcional.'});
 await service.decide(actor(4),id,{stage:'level4',approved:true,note:'Escopo excepcional conferido.'});
 const result=await service.decide(actor(5),id,{stage:'level5',approved:true,note:'Aprovação final do fundador.'});
 assert.equal(result.disclosureAuthorized,true);assert.deepEqual(stages,['legal','level3','level4','level5']);
});

test('authority workflow remains disabled by default',async()=>{
 const service=createAuthorityRequestService({});
 await assert.rejects(service.list(actor(5)),error=>error.code==='authority_requests_disabled');
 assert.equal(loadConfig({NODE_ENV:'test'}).authorityRequestsEnabled,false);
 const env={NODE_ENV:'production',DATABASE_URL:'postgres://fixture',SESSION_SECRET:'s'.repeat(32),NOTIFICATION_WEBHOOK_URL:'https://notify.example.test',NOTIFICATION_WEBHOOK_SECRET:'synthetic',AUTHORITY_REQUESTS_ENABLED:'true'};
 assert.throws(()=>loadConfig(env),/AUTHORITY_REQUESTS_ACTIVATION_ACKNOWLEDGED=true/);
 assert.equal(loadConfig({...env,AUTHORITY_REQUESTS_ACTIVATION_ACKNOWLEDGED:'true'}).authorityRequestsEnabled,true);
});
