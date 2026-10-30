import assert from 'node:assert/strict';
import test from 'node:test';
import {createStaffAccessService} from '../apps/api/staff-access-service.js';

const ids={target:'11111111-1111-4111-8111-111111111111',request:'22222222-2222-4222-8222-222222222222',grant:'33333333-3333-4333-8333-333333333333'};
test('level 4 proposes but only level 5 makes the final decision',async()=>{
 const calls=[],service=createStaffAccessService({async list(){return[];},async propose(input){calls.push(['propose',input]);return{id:ids.request,status:'pending'};},async decide(input){calls.push(['decide',input]);return{id:ids.request,status:input.approved?'approved':'rejected'};}});
 const proposal=await service.propose({id:'admin-4',role:'admin',staffAccessLevel:4},{targetUserId:ids.target,requestedLevel:3,reason:'Conceder acesso financeiro conforme função aprovada.',grantId:ids.grant});assert.equal(proposal.request.status,'pending');
 await assert.rejects(service.decide({id:'admin-4',role:'admin',staffAccessLevel:4},ids.request,{approved:true,reason:'Tentativa sem autoridade final suficiente.',grantId:ids.grant}),error=>error.code==='insufficient_access_level');
 const decision=await service.decide({id:'founder',role:'admin',staffAccessLevel:5},ids.request,{approved:true,reason:'Autorização final do fundador confirmada.',grantId:ids.grant});assert.equal(decision.request.status,'approved');assert.deepEqual(calls.map(call=>call[0]),['propose','decide']);
});

test('staff level requests reject self-described invalid levels and grants',async()=>{
 const service=createStaffAccessService({});
 await assert.rejects(service.propose({id:'admin',role:'admin',staffAccessLevel:4},{targetUserId:ids.target,requestedLevel:5,reason:'Justificativa suficientemente longa.',grantId:ids.grant}),error=>error.code==='invalid_staff_access_change');
});
