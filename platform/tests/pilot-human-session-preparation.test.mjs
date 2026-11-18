import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {
  HUMAN_PENDING_TASKS,
  inspectPilotHumanSessionPreparation,
  validatePilotHumanSessionPreparation,
} from '../tools/pilot-human-session-preparation.mjs';

const readJson=path=>readFile(new URL(path,import.meta.url),'utf8').then(JSON.parse);
const base=await readJson('../config/pilot-human-session-preparation.v1.json');
const preflight=await readJson('../config/pilot-technical-preflight.v1.json');
const copy=()=>structuredClone(base);

test('FC-311 public runbook includes exactly five pending checks and remains NO-GO',async()=>{
  const report=await inspectPilotHumanSessionPreparation();
  assert.equal(report.valid,true,report.errors.join('\n'));
  assert.equal(report.pendingItems,5);
  assert.equal(report.plannedTasks,17);
  assert.equal(report.humanValidationComplete,false);
  assert.equal(report.launchAuthorized,false);
  assert.equal(report.pilotDecision,'NO-GO');
  assert.deepEqual(report.plan.items.map(item=>item.id),preflight.pendingEvidenceIds);
  assert.equal(report.plan.items.every(item=>item.status==='not-executed'),true);
  assert.equal(report.plan.items.every(item=>item.privateEvidenceRef===null),true);
});

test('FC-311 fails closed on fake approvals, launch flags and unsafe session policy',()=>{
  const mutations=[
    p=>{p.status='completed';},
    p=>{p.launchAuthorized=true;},
    p=>{p.humanValidationComplete=true;},
    p=>{p.quality.decision='GO';},
    p=>{p.quality.humanDecisionRecorded=true;},
    p=>{p.quality.blockingFindingsReviewed=true;},
    p=>{p.policy.externalIntegrationsAllowed=true;},
    p=>{p.policy.realTransactionsAllowed=true;},
    p=>{p.policy.syntheticDataOnly=false;},
    p=>{p.policy.publicAccessAllowed=true;},
  ];
  for(const change of mutations){
    const p=copy();change(p);
    const result=validatePilotHumanSessionPreparation(p,preflight);
    assert.equal(result.valid,false,JSON.stringify(p));
    assert.equal(result.launchAuthorized,false);
    assert.equal(result.humanValidationComplete,false);
  }
});

test('FC-311 does not accept partial, duplicate, missing or reclassified preflight evidence',()=>{
  for(const change of [
    p=>{p.items.pop();},
    p=>{p.items[1].id=p.items[0].id;},
    p=>{p.items[0].id='unapproved-extra';},
    p=>{p.items[0].taskIds.pop();},
    p=>{p.items[0].taskIds=[...p.items[0].taskIds,p.items[0].taskIds[0]];},
    p=>{p.items[0].taskIds=p.items[1].taskIds;},
    p=>{p.items[0].status='passed';},
    p=>{p.items[0].humanAttestationRecorded=true;},
    p=>{p.items[0].privateEvidenceRef='private-evidence-001';},
  ]){
    const p=copy();change(p);
    assert.equal(validatePilotHumanSessionPreparation(p,preflight).valid,false);
  }
  const fake=structuredClone(preflight);
  fake.pendingEvidenceIds=fake.pendingEvidenceIds.slice(1);
  assert.equal(validatePilotHumanSessionPreparation(base,fake).valid,false);
  fake.pendingEvidenceIds=[...preflight.pendingEvidenceIds];
  fake.launchAuthorized=true;
  assert.equal(validatePilotHumanSessionPreparation(base,fake).valid,false);
});

test('FC-311 rejects recorded rollbacks or personal data in a public preparation artifact',()=>{
  for(const change of [
    p=>{p.rollbackRoles.primary.accepted=true;},
    p=>{p.rollbackRoles.substitute.privateEvidenceRef='person-123';},
    p=>{p.rollbackRoles.independentObserver.accepted=true;},
    p=>{delete p.rollbackRoles.substitute;},
    p=>{p.rollbackRoles.primary={accepted:false,privateEvidenceRef:null,name:'Sensitive Name'};},
    p=>{p.items[1].privateEmail='personal@example.test';},
    p=>{p.publicObserverPhone='000000000';},
  ]){
    const p=copy();change(p);
    const result=validatePilotHumanSessionPreparation(p,preflight);
    assert.equal(result.valid,false,JSON.stringify(p));
    assert.equal(result.pilotDecision,'NO-GO');
  }
});

test('FC-311 task matrix remains complete and cannot quietly drop human observation',()=>{
  const ids=Object.keys(HUMAN_PENDING_TASKS);
  assert.deepEqual(ids,preflight.pendingEvidenceIds);
  assert.ok(HUMAN_PENDING_TASKS['screen-reader-check'].includes('identify-assistive-technology'));
  assert.ok(HUMAN_PENDING_TASKS['device-matrix'].includes('record-real-device-environment'));
  assert.ok(HUMAN_PENDING_TASKS['rollback-owner'].includes('collect-private-acceptances'));
  for(const item of base.items){
    assert.deepEqual(item.taskIds,HUMAN_PENDING_TASKS[item.id]);
    assert.equal(new Set(item.taskIds).size,item.taskIds.length);
  }
});

test('FC-311 rejects broken or arbitrary public preparation records',()=>{
  for(const p of [null,[],{},'approved']){
    assert.equal(validatePilotHumanSessionPreparation(p,preflight).valid,false);
  }
  const p=copy();p.items[0].taskIds=null;
  assert.equal(validatePilotHumanSessionPreparation(p,preflight).valid,false);
  const extra=copy();extra.items.push({...extra.items[0]});
  assert.equal(validatePilotHumanSessionPreparation(extra,preflight).valid,false);
});
