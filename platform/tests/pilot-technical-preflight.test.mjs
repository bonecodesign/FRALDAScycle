import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectPilotTechnicalPreflight,validatePilotTechnicalPreflight} from '../tools/pilot-technical-preflight.mjs';

const evidence={evidence:Array.from({length:21},(_,index)=>({id:`evidence-${index}`}))};
const base={schemaVersion:1,policy:{syntheticDataOnly:true,externalIntegrationsAllowed:false,realTransactionsAllowed:false,publicAccessAllowed:false},coveredEvidenceIds:Array.from({length:16},(_,index)=>`evidence-${index}`),pendingEvidenceIds:['evidence-16','evidence-17','evidence-18','screen-reader-check','rollback-owner'],humanValidationComplete:false,launchAuthorized:false};

test('current technical preflight covers 16 of 21 items without authorizing launch',async()=>{
  const report=await inspectPilotTechnicalPreflight();
  assert.equal(report.valid,true,report.errors.join('\n'));assert.equal(report.covered,16);assert.equal(report.pending,5);assert.equal(report.launchAuthorized,false);
});

test('preflight fails closed on launch, unsafe policy or missing human-only gates',()=>{
  const registered={evidence:[...evidence.evidence.slice(0,19),{id:'screen-reader-check'},{id:'rollback-owner'}]};
  for(const patch of [{launchAuthorized:true},{humanValidationComplete:true},{policy:{...base.policy,externalIntegrationsAllowed:true}},{pendingEvidenceIds:['rollback-owner']}]){
    const result=validatePilotTechnicalPreflight({...base,...patch},registered);assert.equal(result.valid,false);
  }
});

test('pilot preflight refuses duplicated evidence claims even if unique coverage remains 16 of 21',()=>{
  const registered={evidence:[...evidence.evidence.slice(0,19),{id:'screen-reader-check'},{id:'rollback-owner'}]};
  for(const patch of [
    {coveredEvidenceIds:[...base.coveredEvidenceIds,base.coveredEvidenceIds[0]]},
    {pendingEvidenceIds:[...base.pendingEvidenceIds,'rollback-owner']},
  ]){
    const result=validatePilotTechnicalPreflight({...base,...patch},registered);
    assert.equal(result.valid,false);
    assert.match(result.errors.join(' | '),/unique string array/);
    assert.equal(result.launchAuthorized,false);
  }
});

test('pilot preflight fails closed when evidence registry has duplicate or malformed identifiers',()=>{
  const registered={evidence:[...evidence.evidence.slice(0,19),{id:'screen-reader-check'},{id:'rollback-owner'}]};
  for(const entries of [
    [...registered.evidence,{id:'rollback-owner'}],
    registered.evidence.map((item,index)=>index===20?{id:'screen-reader-check'}:item),
    registered.evidence.map((item,index)=>index===20?{id:42}:item),
  ]){
    const result=validatePilotTechnicalPreflight(base,{evidence:entries});
    assert.equal(result.valid,false);
    assert.match(result.errors.join(' | '),/21 distinct valid identifiers/);
    assert.equal(result.launchAuthorized,false);
  }
});

test('pilot preflight refuses malformed evidence arrays instead of silently classifying them',()=>{
  const registered={evidence:[...evidence.evidence.slice(0,19),{id:'screen-reader-check'},{id:'rollback-owner'}]};
  for(const patch of [
    {coveredEvidenceIds:null},
    {coveredEvidenceIds:'evidence-0'},
    {pendingEvidenceIds:null},
    {pendingEvidenceIds:['screen-reader-check',null]},
  ]){
    const result=validatePilotTechnicalPreflight({...base,...patch},registered);
    assert.equal(result.valid,false);
    assert.match(result.errors.join(' | '),/unique string array/);
    assert.equal(result.launchAuthorized,false);
  }
  const invalidRegister=validatePilotTechnicalPreflight(base,{evidence:'not-an-array'});
  assert.equal(invalidRegister.valid,false);
  assert.match(invalidRegister.errors.join(' | '),/21 distinct valid identifiers/);
});

test('pilot preflight rejects a claimed pass when underlying evidence is failed or skipped',async()=>{
  const {readFile}=await import('node:fs/promises');
  const [preflight,registered]=await Promise.all([
    readFile(new URL('../config/pilot-technical-preflight.v1.json',import.meta.url),'utf8').then(JSON.parse),
    readFile(new URL('../config/pilot-evidence.v1.json',import.meta.url),'utf8').then(JSON.parse),
  ]);
  const good=validatePilotTechnicalPreflight(preflight,registered);
  assert.equal(good.valid,true,good.errors.join(' | '));
  const covered=registered.evidence.find(item=>preflight.coveredEvidenceIds.includes(item.id));
  covered.status='failed';
  const result=validatePilotTechnicalPreflight(preflight,registered);
  assert.equal(result.valid,false);
  assert.match(result.errors.join(' | '),/covered evidence is not passed/);
  assert.equal(result.launchAuthorized,false);
});
