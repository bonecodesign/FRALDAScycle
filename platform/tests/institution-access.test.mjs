import assert from 'node:assert/strict';
import test from 'node:test';
import {createInstitutionAccessService} from '../apps/api/institution-access-service.js';
import {createInstitutionRepository} from '../database/institution-repository.js';
import {institutionTransitionAllowed} from '../packages/contracts/institution-status.js';
const id='11111111-1111-4111-8111-111111111111';
test('institution authority needs scoped reviewer, session owner and explicit version',()=>{
 const service=createInstitutionAccessService({accept(v){return v;},assign(v){return v;},list(v){return v;}});
 assert.throws(()=>service.assign({id:'mod',role:'moderator'},id,null),e=>e.status===403);
 assert.throws(()=>service.accept({id:'own'},id,{expectedVersion:1,confirmed:true,userId:'foreign'}),e=>e.status===422);
 assert.equal(service.accept({id:'own'},id,{expectedVersion:1,confirmed:true}).actorId,'own');
 assert.equal(service.list({id:'own',role:'customer'}).reviewer,false);
 assert.equal(service.assign({id:'admin',role:'admin'},id,{userId:id,expectedVersion:0,confirmed:true,reason:'Conferência fictícia da representação.'}).expectedVersion,0);
});
test('institution status is revalidated under the database lock',async()=>{
 let calls=0;const repository=createInstitutionRepository({async transaction(fn){return fn({async query(){calls++;return {rows:[{id,status:'rejected'}]};}});}});
 await assert.rejects(repository.changeStatus({actorUserId:id,institutionId:id,status:'active',reason:'Conferência fictícia anterior.',expectedStatus:'under_review'}),e=>e.code==='institution_status_conflict');
 assert.equal(calls,1);
});
test('institution transition graph has no direct rejection activation or reopening of closed record',()=>{
 assert.equal(institutionTransitionAllowed('under_review','active'),true);
 assert.equal(institutionTransitionAllowed('rejected','active'),false);
 assert.equal(institutionTransitionAllowed('closed','under_review'),false);
});
