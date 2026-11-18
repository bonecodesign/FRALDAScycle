import {readFile} from 'node:fs/promises';
import {isMainModule} from '../packages/contracts/main-module.js';

export const HUMAN_PENDING_TASKS=Object.freeze({
  'publish-search-negotiate':Object.freeze([
    'confirm-synthetic-media-sandbox','publish-eight-step-flow',
    'independent-review-observation','verify-search-and-unpaid-chat',
  ]),
  'keyboard-check':Object.freeze([
    'walk-with-keyboard-only','verify-focus-and-skip-links',
    'verify-form-errors-and-live-status',
  ]),
  'device-matrix':Object.freeze([
    'record-real-device-environment','exercise-portrait-and-landscape',
    'verify-navigation-and-zoom',
  ]),
  'screen-reader-check':Object.freeze([
    'identify-assistive-technology','observe-forms-search-and-feedback',
    'observe-purchase-gate-and-support',
  ]),
  'rollback-owner':Object.freeze([
    'nominate-independent-roles','collect-private-acceptances',
    'rehearse-three-incidents','confirm-segregated-recovery-decision',
  ]),
});

const POLICIES=Object.freeze({
  syntheticDataOnly:true,
  externalIntegrationsAllowed:false,
  realTransactionsAllowed:false,
  publicAccessAllowed:false,
});
const hasExactKeys=(obj,keys)=>obj!==null&&typeof obj==='object'&&!Array.isArray(obj)
  &&Object.keys(obj).length===keys.length&&keys.every(key=>Object.hasOwn(obj,key));

/**
 * Only validates a PUBLIC, unexecuted runbook; never evaluates human proof or
 * changes the technical preflight. Human evidence lives in an access-controlled
 * private record and must receive independent review outside this CLI.
 */
export function validatePilotHumanSessionPreparation(plan,preflight){
  const errors=[];
  const expectedIds=Object.keys(HUMAN_PENDING_TASKS);
  if(!hasExactKeys(plan,[
    'schemaVersion','status','source','policy','items','rollbackRoles',
    'quality','humanValidationComplete','launchAuthorized',
  ]))errors.push('preparation must contain only approved public fields');
  if(plan?.schemaVersion!==1)errors.push('schemaVersion must equal 1');
  if(plan?.status!=='prepared-not-executed')errors.push('session must remain prepared-not-executed');
  if(plan?.source!=='config/pilot-technical-preflight.v1.json')errors.push('source must refer to the official preflight');
  if(!hasExactKeys(plan?.policy,Object.keys(POLICIES))||Object.entries(POLICIES).some(([key,value])=>plan.policy?.[key]!==value)){
    errors.push('policy must keep synthetic data and all external actions disabled');
  }
  if(plan?.humanValidationComplete!==false)errors.push('humanValidationComplete must remain false');
  if(plan?.launchAuthorized!==false)errors.push('launchAuthorized must remain false');
  if(!Array.isArray(preflight?.pendingEvidenceIds)
    ||preflight.pendingEvidenceIds.length!==expectedIds.length
    ||new Set(preflight.pendingEvidenceIds).size!==expectedIds.length
    ||expectedIds.some(id=>!preflight.pendingEvidenceIds.includes(id))
    ||preflight?.humanValidationComplete!==false
    ||preflight?.launchAuthorized!==false)errors.push('official preflight must preserve five pending items and NO-GO');
  const items=Array.isArray(plan?.items)?plan.items:[];
  if(items.length!==expectedIds.length)errors.push('preparation must cover all five pending evidence items');
  const seen=new Set();
  for(const [index,item] of items.entries()){
    const at='items['+index+']';
    if(!hasExactKeys(item,['id','taskIds','status','humanAttestationRecorded','privateEvidenceRef'])){
      errors.push(at+' may only contain public preparation fields');
    }
    if(!expectedIds.includes(item?.id)||seen.has(item.id))errors.push(at+' has unknown or duplicated id');
    else seen.add(item.id);
    const expectedTasks=HUMAN_PENDING_TASKS[item?.id];
    if(!expectedTasks||!Array.isArray(item?.taskIds)
      ||JSON.stringify(item.taskIds)!==JSON.stringify(expectedTasks)){
      errors.push(at+' tasks must match the official human checklist');
    }
    if(item?.status!=='not-executed'||item?.humanAttestationRecorded!==false||item?.privateEvidenceRef!==null){
      errors.push(at+' cannot claim human execution, acceptance or private evidence in the public repository');
    }
  }
  for(const id of expectedIds)if(!seen.has(id))errors.push('missing pending evidence: '+id);
  if(!hasExactKeys(plan?.rollbackRoles,['primary','substitute','independentObserver'])){
    errors.push('primary, substitute and independent rollback observer must remain distinct planned roles');
  }
  for(const role of ['primary','substitute','independentObserver']){
    const value=plan?.rollbackRoles?.[role];
    if(!hasExactKeys(value,['accepted','privateEvidenceRef'])||value?.accepted!==false||value?.privateEvidenceRef!==null){
      errors.push('rollback '+role+' must remain unaccepted without public personal references');
    }
  }
  if(!hasExactKeys(plan?.quality,['blockingFindingsReviewed','humanDecisionRecorded','decision'])
    ||plan.quality?.blockingFindingsReviewed!==false
    ||plan.quality?.humanDecisionRecorded!==false
    ||plan.quality?.decision!=='NO-GO'){
    errors.push('quality decision cannot be marked as human-reviewed, accepted or GO');
  }
  return Object.freeze({
    valid:errors.length===0,
    errors:Object.freeze(errors),
    pendingItems:items.length,
    plannedTasks:items.reduce((n,item)=>n+(Array.isArray(item?.taskIds)?item.taskIds.length:0),0),
    humanValidationComplete:false,
    launchAuthorized:false,
    pilotDecision:'NO-GO',
  });
}

export async function inspectPilotHumanSessionPreparation(
  planPath=new URL('../config/pilot-human-session-preparation.v1.json',import.meta.url),
  preflightPath=new URL('../config/pilot-technical-preflight.v1.json',import.meta.url),
){
  const [plan,preflight]=await Promise.all(
    [planPath,preflightPath].map(path=>readFile(path,'utf8').then(JSON.parse)),
  );
  return {plan,...validatePilotHumanSessionPreparation(plan,preflight)};
}

if(isMainModule(import.meta.url)){
  try{
    const report=await inspectPilotHumanSessionPreparation();
    console.log(JSON.stringify({
      valid:report.valid,errors:report.errors,pendingItems:report.pendingItems,
      plannedTasks:report.plannedTasks,humanValidationComplete:false,
      launchAuthorized:false,pilotDecision:'NO-GO',
    },null,2));
    if(!report.valid)process.exitCode=1;
  }catch(error){
    console.error(JSON.stringify({valid:false,errors:['unable to validate preparation file'],launchAuthorized:false},null,2));
    process.exitCode=1;
  }
}
