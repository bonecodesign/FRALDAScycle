import {access, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {isMainModule} from '../packages/contracts/main-module.js';

const EXPECTED_AREAS=Object.freeze({
  finance:[2,3,10,12],
  'family-privacy':[26,27,28,31,32,33],
  'visual-moderation':[41],
  'account-terms':[45,46],
  'communications-incidents':[49,51,56],
  infrastructure:[57,59],
  'vendors-insurance':[60,61],
  institutions:[62],
  'pilot-accessibility':[67],
});
const ALLOWED_ROLES=new Set([
  'juridico','privacidade','produto','seguranca','financeiro','contabilidade',
  'suporte','operacao','fundador','moderacao','observador','acessibilidade',
]);
const PLAN_KEYS=[
  'schemaVersion','asOf','state','sourceMatrix','sourceBoard','founderOnlyNamed',
  'noGo','allowsRealData','allowsExternalCalls','allowsRealPayments',
  'allowsFeatureActivation','allowsLaunch','areas','finalDecision',
];
const AREA_KEYS=[
  'id','order','title','requirementIds','status','runbook','taskIds',
  'requiredRoles','requiredEvidence','evidenceReference','approvalReference',
];
const FINAL_KEYS=[
  'status','allAreasApproved','founderDecisionRecorded','launchAuthorized',
  'approvalReference',
];
const exactKeys=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const sameMembers=(left,right)=>Array.isArray(left)&&left.length===right.length
  &&new Set(left).size===left.length&&right.every(value=>left.includes(value));
const validSlug=value=>typeof value==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export async function validateLaunchPreparation(
  plan,matrix,board,root=resolve(import.meta.dirname,'..'),
){
  const errors=[];
  if(!exactKeys(plan,PLAN_KEYS))errors.push('plan contains unknown or missing public fields');
  if(plan?.schemaVersion!==1||plan?.asOf!=='2026-11-20'
    ||plan?.state!=='prepared-not-executed'
    ||plan?.sourceMatrix!=='docs/requirements-matrix.json'
    ||plan?.sourceBoard!=='config/codex-action-board.v1.json'){
    errors.push('plan identity or source is invalid');
  }
  for(const [field,expected] of Object.entries({
    founderOnlyNamed:true,noGo:true,allowsRealData:false,allowsExternalCalls:false,
    allowsRealPayments:false,allowsFeatureActivation:false,allowsLaunch:false,
  }))if(plan?.[field]!==expected)errors.push(field+' violates prelaunch safety');

  const pending=(matrix?.requirements??[]).filter(item=>item.status!=='concluido').map(item=>item.id);
  const boardPending=(board?.workstreams??[]).flatMap(item=>item.requirementIds);
  if(matrix?.denominator!==70||matrix?.requirements?.length!==70||pending.length!==22
    ||!sameMembers(boardPending,pending))errors.push('official pending requirement sources are inconsistent');

  const areas=Array.isArray(plan?.areas)?plan.areas:[];
  if(areas.length!==Object.keys(EXPECTED_AREAS).length)errors.push('exactly nine launch areas are required');
  const areaIds=new Set(),taskIds=new Set(),covered=[];
  let plannedTasks=0,requiredEvidence=0;
  for(const [index,area] of areas.entries()){
    const at='areas['+index+']';
    if(!exactKeys(area,AREA_KEYS))errors.push(at+' contains unknown or missing fields');
    if(!Object.hasOwn(EXPECTED_AREAS,area?.id)||areaIds.has(area.id)
      ||area?.order!==index+1||!area?.title?.trim()
      ||!sameMembers(area?.requirementIds,EXPECTED_AREAS[area?.id])){
      errors.push(at+' has invalid identity, order or requirement coverage');
    }else areaIds.add(area.id);
    covered.push(...(Array.isArray(area?.requirementIds)?area.requirementIds:[]));
    if(area?.status!=='waiting-human-or-external'||area?.evidenceReference!==null
      ||area?.approvalReference!==null)errors.push(at+' cannot claim execution or approval');
    if(typeof area?.runbook!=='string'||!/^docs\/[a-z0-9/-]+[.]md$/.test(area.runbook)){
      errors.push(at+' has an invalid runbook');
    }else{
      try{await access(resolve(root,area.runbook));}catch{errors.push(at+' runbook does not exist');}
    }
    if(!Array.isArray(area?.taskIds)||area.taskIds.length<4
      ||area.taskIds.some(task=>!validSlug(task)||taskIds.has(task))){
      errors.push(at+' tasks must be unique meaningful slugs');
    }else for(const task of area.taskIds)taskIds.add(task);
    plannedTasks+=Array.isArray(area?.taskIds)?area.taskIds.length:0;
    if(!Array.isArray(area?.requiredRoles)||area.requiredRoles.length<2
      ||!area.requiredRoles.includes('fundador')
      ||new Set(area.requiredRoles).size!==area.requiredRoles.length
      ||area.requiredRoles.some(role=>!ALLOWED_ROLES.has(role))){
      errors.push(at+' requires valid segregated roles and final founder review');
    }
    if(!Array.isArray(area?.requiredEvidence)||area.requiredEvidence.length<4
      ||new Set(area.requiredEvidence).size!==area.requiredEvidence.length
      ||area.requiredEvidence.some(item=>!validSlug(item))){
      errors.push(at+' requires explicit evidence slugs');
    }
    requiredEvidence+=Array.isArray(area?.requiredEvidence)?area.requiredEvidence.length:0;
  }
  if(!sameMembers(covered,pending))errors.push('launch areas must cover every pending requirement exactly once');

  const finalDecision=plan?.finalDecision;
  if(!exactKeys(finalDecision,FINAL_KEYS)||finalDecision?.status!=='NO-GO'
    ||finalDecision?.allAreasApproved!==false
    ||finalDecision?.founderDecisionRecorded!==false
    ||finalDecision?.launchAuthorized!==false
    ||finalDecision?.approvalReference!==null){
    errors.push('final decision must remain unapproved NO-GO');
  }
  return Object.freeze({
    valid:errors.length===0,errors:Object.freeze(errors),areas:areas.length,
    pendingRequirements:pending.length,plannedTasks,requiredEvidence,
    founderOnlyNamed:true,launchAuthorized:false,pilotDecision:'NO-GO',
  });
}

export async function inspectLaunchPreparation(
  planPath=new URL('../config/launch-preparation.v1.json',import.meta.url),
  matrixPath=new URL('../docs/requirements-matrix.json',import.meta.url),
  boardPath=new URL('../config/codex-action-board.v1.json',import.meta.url),
){
  const [plan,matrix,board]=await Promise.all([planPath,matrixPath,boardPath]
    .map(path=>readFile(path,'utf8').then(JSON.parse)));
  return {plan,...await validateLaunchPreparation(plan,matrix,board)};
}

if(isMainModule(import.meta.url)){
  try{
    const {plan:unused,...report}=await inspectLaunchPreparation();
    console.log(JSON.stringify(report,null,2));
    if(!report.valid)process.exitCode=1;
  }catch{
    console.error(JSON.stringify({valid:false,errors:['unable to validate launch preparation'],launchAuthorized:false},null,2));
    process.exitCode=1;
  }
}
