import assert from 'node:assert/strict';
import test from 'node:test';
import {previewSupportEscalation} from '../packages/contracts/support-escalation-preview.js';
const uuids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444',
 '55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666'];
const ticket=(id,priority='critical')=>({id,priority,status:'open',first_response_at:null,first_response_due_at:'2026-11-19T14:00:00.000Z'});
const duties=[
 {role_kind:'primary',target_user_id:uuids[1],status:'accepted',verified:true},
 {role_kind:'substitute',target_user_id:uuids[2],status:'accepted',verified:true},
];
const coordinators=[
 {user_id:uuids[3],staff_access_level:4,verified:true},
 {user_id:uuids[4],staff_access_level:5,verified:true},
];

test('escalation preflight fails closed without individually accepted and verified people',()=>{
 const result=previewSupportEscalation({tickets:[ticket(uuids[0])]});
 assert.equal(result.routes[0].readiness,'missing_coverage');
 assert.deepEqual(result.routes[0].missing,['primary','substitute','level4','level5']);
 assert.equal(result.routes[0].plannedRecipients.length,0);
 assert.equal(result.channelVerified,false);
 assert.equal(result.staffingVerified,false);
 for(const key of ['externalDispatchAuthorized','internalDispatchAuthorized','automaticPauseAuthorized','sendAttempted'])assert.equal(result[key],false);
 assert.equal(result.preventionPreview.criticalCoverageMissing,true);
});

test('an accepted, distinct escalation routing stays PREVIEW ONLY with no delivery',()=>{
 const result=previewSupportEscalation({tickets:[ticket(uuids[0])],duties,coordinators});
 assert.equal(result.routes[0].readiness,'prepared_not_activated');
 assert.deepEqual(result.routes[0].plannedRecipients.map(x=>x.role),['primary','substitute','level4','level5']);
 assert.equal(result.routes[0].actualDispatch,false);
 assert.equal(result.externalDispatchAuthorized,false);
 assert.equal(result.internalDispatchAuthorized,false);
 assert.equal(result.automaticPauseAuthorized,false);
});

test('incomplete acceptance, duplicate humans, and missing founder never qualify as covered',()=>{
 const pending=[duties[0],{...duties[1],status:'pending'}];
 assert.deepEqual(previewSupportEscalation({tickets:[ticket(uuids[0],'low')],duties:pending,coordinators}).routes[0].missing,['substitute']);
 const duplicate=[duties[0],{...duties[1],target_user_id:duties[0].target_user_id}];
 assert.ok(previewSupportEscalation({tickets:[ticket(uuids[0])],duties:duplicate,coordinators}).routes[0].missing.includes('independent_recipients_required'));
 assert.ok(previewSupportEscalation({tickets:[ticket(uuids[0])],duties,coordinators:coordinators.slice(0,1)}).routes[0].missing.includes('level5'));
 assert.equal(previewSupportEscalation({tickets:[ticket(uuids[0],'normal')],duties,coordinators:[]}).routes[0].readiness,'prepared_not_activated');
});

test('critical workload and ordering generate only a HUMAN review preview',()=>{
 const a=ticket(uuids[0],'low'),b=ticket(uuids[4]),c=ticket(uuids[3]),d=ticket(uuids[5]);
 const result=previewSupportEscalation({tickets:[a,b,c,d],duties,coordinators});
 assert.equal(result.routes[0].priority,'critical');
 assert.equal(result.routes.at(-1).priority,'low');
 assert.equal(result.criticalOverdue,3);
 assert.equal(result.preventionPreview.threeCriticalOverdue,true);
 assert.equal(result.preventionPreview.humanDecisionRequired,true);
 assert.equal(result.automaticPauseAuthorized,false);
});

test('aggregate critical overload cannot disappear when preview is capped at 50',()=>{
 const result=previewSupportEscalation({tickets:[ticket(uuids[0],'low')],overdueTotal:140,criticalOverdue:4});
 assert.equal(result.routes.length,1);
 assert.equal(result.overdueTotal,140);
 assert.equal(result.criticalOverdue,4);
 assert.equal(result.preventionPreview.threeCriticalOverdue,true);
 assert.equal(result.preventionPreview.humanDecisionRequired,true);
 assert.equal(result.automaticPauseAuthorized,false);
 assert.throws(()=>previewSupportEscalation({tickets:[ticket(uuids[0])],overdueTotal:1,criticalOverdue:0}),/aggregate/);
});

test('preflight rejects malformed or answered records and unbounded batches',()=>{
 assert.throws(()=>previewSupportEscalation({tickets:[{...ticket(uuids[0]),first_response_at:'2026-11-19T14:30:00Z'}]}),/classified/);
 assert.throws(()=>previewSupportEscalation({tickets:[ticket('not-uuid')]}),/classified/);
 assert.throws(()=>previewSupportEscalation({tickets:Array.from({length:51},()=>ticket(uuids[0]))}),/bound/);
 assert.throws(()=>previewSupportEscalation({tickets:'invalid'}),/arrays/);
 assert.deepEqual(previewSupportEscalation({tickets:[]}).routes,[]);
});
