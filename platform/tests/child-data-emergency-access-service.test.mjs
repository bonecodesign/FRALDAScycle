import assert from 'node:assert/strict';
import test from 'node:test';
import {loadConfig} from '../apps/api/config.js';
import {createChildDataEmergencyAccessService} from '../apps/api/child-data-emergency-access-service.js';
const requestId='11111111-1111-4111-8111-111111111111',profileId='22222222-2222-4222-8222-222222222222',grantId='33333333-3333-4333-8333-333333333333';
const actor=level=>({id:`${level}1111111-1111-4111-8111-111111111111`,role:'admin',staffAccessLevel:level});
test('emergency access stays disabled and production requires independent acknowledgement',async()=>{
 await assert.rejects(createChildDataEmergencyAccessService({}).list(actor(5)),error=>error.code==='child_data_emergency_access_disabled');
 assert.equal(loadConfig({NODE_ENV:'test'}).childDataEmergencyAccessEnabled,false);
 assert.throws(()=>loadConfig({NODE_ENV:'test',CHILD_DATA_EMERGENCY_ACCESS_ENABLED:'true'}),/requires CHILD_PROFILES_ENABLED/);
 const env={NODE_ENV:'production',DATABASE_URL:'postgres://fixture',SESSION_SECRET:'s'.repeat(32),NOTIFICATION_WEBHOOK_URL:'https://notify.example.test',NOTIFICATION_WEBHOOK_SECRET:'synthetic',CHILD_PROFILES_ENABLED:'true',CHILD_PROFILES_ACTIVATION_ACKNOWLEDGED:'true',CHILD_DATA_EMERGENCY_ACCESS_ENABLED:'true'};
 assert.throws(()=>loadConfig(env),/CHILD_DATA_EMERGENCY_ACCESS_ACTIVATION_ACKNOWLEDGED=true/);
 assert.equal(loadConfig({...env,CHILD_DATA_EMERGENCY_ACCESS_ACTIVATION_ACKNOWLEDGED:'true'}).childDataEmergencyAccessEnabled,true);
});
test('two independent domains grant a read-only fifteen-minute window',async()=>{
 const calls=[],repository={async request(input){calls.push(['request',input]);return{id:requestId,status:'pending'};},async approve(input){calls.push(['approve',input]);return input.domain==='privacy'?{approval:{},grant:{id:grantId}}:{approval:{},grant:null};},async read(input){calls.push(['read',input]);return{profileId,birthDate:'2025-01-01',expiresAt:'2030-01-01T00:15:00Z',watermark:'FraldaCycle • acesso emergencial • ator • horário'};},async list(){return[];}};
 const service=createChildDataEmergencyAccessService(repository,{enabled:true,clock:()=>new Date('2030-01-01T00:00:00Z')});
 await assert.rejects(service.request(actor(1),{}),error=>error.code==='insufficient_access_level');
 assert.equal((await service.request(actor(2),{profileId,justification:'Incidente relevante exige conferência excepcional.'})).accessGranted,false);
 await assert.rejects(service.approve(actor(3),requestId,{}),error=>error.code==='insufficient_access_level');
 assert.equal((await service.approve(actor(4),requestId,{domain:'security',approved:true,note:'Segurança aprovou a finalidade.'})).accessGranted,false);
 const granted=await service.approve(actor(5),requestId,{domain:'privacy',approved:true,note:'Privacidade aprovou a minimização.'});assert.equal(granted.accessGranted,true);assert.equal(granted.expiresInMinutes,15);assert.equal(granted.readOnly,true);
 const read=await service.read(actor(2),grantId);assert.equal(read.birthDate,'2025-01-01');assert.equal(read.readOnly,true);assert.match(read.watermark,/acesso emergencial/);assert.deepEqual(calls.map(call=>call[0]),['request','approve','approve','read']);
});
