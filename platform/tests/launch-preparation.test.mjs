import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {inspectLaunchPreparation,validateLaunchPreparation} from '../tools/launch-preparation.mjs';

const readJson=path=>readFile(new URL(path,import.meta.url),'utf8').then(JSON.parse);
const [plan,matrix,board]=await Promise.all([
  readJson('../config/launch-preparation.v1.json'),
  readJson('../docs/requirements-matrix.json'),
  readJson('../config/codex-action-board.v1.json'),
]);
const copy=()=>structuredClone(plan);

test('launch preparation covers all 22 pending requirements and remains NO-GO',async()=>{
  const {plan:unused,...report}=await inspectLaunchPreparation();
  assert.deepEqual(report,{
    valid:true,errors:[],areas:9,pendingRequirements:22,plannedTasks:37,
    requiredEvidence:37,founderOnlyNamed:true,launchAuthorized:false,
    pilotDecision:'NO-GO',
  });
  assert.equal(new Set(plan.areas.flatMap(area=>area.requirementIds)).size,22);
});

test('founder-only preparation cannot silently name staff or activate external work',async()=>{
  for(const change of [
    value=>{value.founderOnlyNamed=false;},
    value=>{value.noGo=false;},
    value=>{value.allowsRealData=true;},
    value=>{value.allowsExternalCalls=true;},
    value=>{value.allowsRealPayments=true;},
    value=>{value.allowsFeatureActivation=true;},
    value=>{value.allowsLaunch=true;},
  ]){
    const changed=copy();change(changed);
    const report=await validateLaunchPreparation(changed,matrix,board);
    assert.equal(report.valid,false);
    assert.equal(report.launchAuthorized,false);
  }
});

test('areas cannot claim evidence, approval or GO before external and human execution',async()=>{
  for(const change of [
    value=>{value.areas[0].status='approved';},
    value=>{value.areas[0].evidenceReference='fake-evidence';},
    value=>{value.areas[0].approvalReference='fake-approval';},
    value=>{value.finalDecision.status='GO';},
    value=>{value.finalDecision.allAreasApproved=true;},
    value=>{value.finalDecision.founderDecisionRecorded=true;},
    value=>{value.finalDecision.launchAuthorized=true;},
    value=>{value.finalDecision.approvalReference='fake-decision';},
  ]){
    const changed=copy();change(changed);
    assert.equal((await validateLaunchPreparation(changed,matrix,board)).valid,false);
  }
});

test('coverage, evidence, reviewers, tasks and runbooks fail closed when altered',async()=>{
  const mutations=[
    value=>{value.areas.pop();},
    value=>{value.areas[0].requirementIds.pop();},
    value=>{value.areas[1].requirementIds.push(2);},
    value=>{value.areas[2].requiredRoles=['fundador'];},
    value=>{value.areas[3].requiredRoles.push('codex');},
    value=>{value.areas[4].requiredEvidence=[];},
    value=>{value.areas[5].taskIds[0]=value.areas[0].taskIds[0];},
    value=>{value.areas[6].runbook='docs/missing.md';},
    value=>{value.areas[7].unexpected='not-allowed';},
  ];
  for(const change of mutations){
    const changed=copy();change(changed);
    assert.equal((await validateLaunchPreparation(changed,matrix,board)).valid,false);
  }
});
