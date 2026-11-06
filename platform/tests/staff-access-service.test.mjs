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

test('level 4 proposes a legacy sector and only level 5 decides it',async()=>{
 const calls=[],service=createStaffAccessService({async listSectors(){return{requests:[],unassigned:[{id:ids.target}]};},async proposeSector(input){calls.push(['proposeSector',input]);return{id:ids.request,status:'pending'};},async decideSector(input){calls.push(['decideSector',input]);return{id:ids.request,status:input.approved?'approved':'rejected'};}});
 const listed=await service.listSectors({id:'admin-4',role:'admin',staffAccessLevel:4});assert.equal(listed.unassigned.length,1);
 await service.proposeSector({id:'admin-4',role:'admin',staffAccessLevel:4},{targetUserId:ids.target,requestedSector:'technical',reason:'Regularizar a conta para atuação exclusiva no setor técnico.',grantId:ids.grant});
 await assert.rejects(service.decideSector({id:'admin-4',role:'admin',staffAccessLevel:4},ids.request,{approved:true,reason:'Tentativa sem autorização final do fundador.',grantId:ids.grant}),error=>error.code==='insufficient_access_level');
 const result=await service.decideSector({id:'founder',role:'admin',staffAccessLevel:5},ids.request,{approved:true,reason:'Setor técnico confirmado após revisão final.',grantId:ids.grant});assert.equal(result.request.status,'approved');assert.deepEqual(calls.map(call=>call[0]),['proposeSector','decideSector']);
});

test('sector regularization accepts only the approved sector vocabulary',async()=>{
 const service=createStaffAccessService({});
 await assert.rejects(service.proposeSector({id:'admin-4',role:'admin',staffAccessLevel:4},{targetUserId:ids.target,requestedSector:'all_access',reason:'Setor inexistente não pode ser utilizado.',grantId:ids.grant}),error=>error.code==='invalid_staff_sector_change');
});
