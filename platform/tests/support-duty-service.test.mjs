import assert from 'node:assert/strict';
import test from 'node:test';
import {createSupportDutyService} from '../apps/api/support-duty-service.js';
const id='11111111-1111-4111-8111-111111111111',proposal='22222222-2222-4222-8222-222222222222',grant='33333333-3333-4333-8333-333333333333';
const actors={
 proposer:{id:'proposer',role:'admin',staffAccessLevel:3,staffSector:'support'},
 reviewer:{id:'reviewer',role:'admin',staffAccessLevel:4,staffSector:'operations'},
 founder:{id:'founder',role:'admin',staffAccessLevel:5,staffSector:'founder'},
 nominee:{id,role:'moderator',staffAccessLevel:1,staffSector:'support'},
 customer:{id:'customer',role:'customer'},
};
const service=(calls)=>createSupportDutyService({
 propose:async x=>(calls.push(['propose',x]),{id:proposal,status:'pending_review'}),
 review:async x=>(calls.push(['review',x]),{id:proposal,status:'pending_founder'}),
 decide:async x=>(calls.push(['decide',x]),{proposal:{id:proposal,status:'approved'}}),
 respond:async x=>(calls.push(['respond',x]),{id,status:'accepted'}),
 revoke:async x=>(calls.push(['revoke',x]),{id,status:'revoked'}),
 list:async()=>({proposals:[],assignments:[]}),
});
test('exact access levels and sectors preserve independent proposal, review and founder gate',async()=>{
 const calls=[],s=service(calls),input={targetUserId:id,roleKind:'primary',reason:'Proposta fictícia para atuação no suporte.',grantId:grant};
 await assert.rejects(s.propose(actors.founder,input),e=>e.status===403);
 await assert.rejects(s.propose(actors.customer,input),e=>e.status===403);
 await assert.rejects(s.review(actors.proposer,proposal,{approved:true,reason:input.reason,grantId:grant}),e=>e.status===403);
 await assert.rejects(s.decide(actors.reviewer,proposal,{approved:true,reason:input.reason,grantId:grant}),e=>e.status===403);
 await assert.rejects(s.revoke(actors.reviewer,proposal,{reason:input.reason,grantId:grant}),e=>e.status===403);
 await s.propose(actors.proposer,input);
 await s.review(actors.reviewer,proposal,{approved:true,reason:input.reason,grantId:grant});
 await s.decide(actors.founder,proposal,{approved:true,reason:input.reason,grantId:grant});
 await s.respond(actors.nominee,proposal,{accepted:true,grantId:grant});
 await s.revoke(actors.founder,proposal,{reason:input.reason,grantId:grant});
 assert.deepEqual(calls.map(x=>x[0]),['propose','review','decide','respond','revoke']);
 assert.equal(calls[3][1].actorId,id);
});
test('strict allowlists forbid unauthorized status/roles and injection',async()=>{
 const calls=[],s=service(calls),input={targetUserId:id,roleKind:'primary',reason:'Proposta fictícia para atuação no suporte.',grantId:grant};
 await assert.rejects(s.propose(actors.proposer,{...input,status:'accepted'}),e=>e.status===422);
 await assert.rejects(s.propose(actors.proposer,{...input,roleKind:'founder'}),e=>e.status===422);
 await assert.rejects(s.propose(actors.proposer,{...input,grantId:'invalid'}),e=>e.status===422);
 await assert.rejects(s.review(actors.reviewer,proposal,{approved:'true',reason:input.reason,grantId:grant}),e=>e.status===422);
 await assert.rejects(s.respond(actors.nominee,proposal,{accepted:true,grantId:grant,author:'admin'}),e=>e.status===422);
 await assert.rejects(s.respond(actors.customer,proposal,{accepted:true,grantId:grant}),e=>e.status===403);
 await assert.deepEqual(calls,[]);
});
test('role list hides appointment actions from users outside governance and never claims a live shift',async()=>{
 const s=service([]);await assert.rejects(s.list(actors.customer),e=>e.status===403);
 const l=await s.list(actors.nominee);
 assert.equal(l.canPropose,false);assert.equal(l.canReview,false);assert.equal(l.canDecide,false);
 assert.equal(l.realStaffingActive,false);assert.equal(l.externalDispatchAuthorized,false);
 assert.equal(l.automaticPauseAuthorized,false);
 assert.equal((await s.list(actors.founder)).canDecide,true);
});
