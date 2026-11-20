import {readFile} from 'node:fs/promises';

const EXPECTED_AREAS=9;
const WAITING='waiting-human-or-external';

function invalid(){
  const error=new Error('launch_preparation_invalid');
  error.code='launch_preparation_invalid';
  throw error;
}

export function createLaunchPreparationSnapshot(plan){
  if(!plan||plan.schemaVersion!==1||plan.state!=='prepared-not-executed'
    ||plan.noGo!==true||plan.founderOnlyNamed!==true
    ||plan.allowsRealData!==false||plan.allowsExternalCalls!==false
    ||plan.allowsRealPayments!==false||plan.allowsFeatureActivation!==false
    ||plan.allowsLaunch!==false||!Array.isArray(plan.areas)
    ||plan.areas.length!==EXPECTED_AREAS
    ||plan.finalDecision?.status!=='NO-GO'
    ||plan.finalDecision?.launchAuthorized!==false){
    invalid();
  }
  const ids=new Set();
  const requirements=new Set();
  let plannedTasks=0,requiredEvidence=0;
  const areas=plan.areas.map((area,index)=>{
    if(!area||typeof area.id!=='string'||ids.has(area.id)||area.order!==index+1
      ||typeof area.title!=='string'||!area.title.trim()||area.status!==WAITING
      ||area.evidenceReference!==null||area.approvalReference!==null
      ||!Array.isArray(area.requirementIds)||!area.requirementIds.length
      ||!Array.isArray(area.taskIds)||area.taskIds.length<1
      ||!Array.isArray(area.requiredEvidence)||area.requiredEvidence.length<1){
      invalid();
    }
    ids.add(area.id);
    for(const requirementId of area.requirementIds){
      if(!Number.isInteger(requirementId)||requirements.has(requirementId))invalid();
      requirements.add(requirementId);
    }
    plannedTasks+=area.taskIds.length;
    requiredEvidence+=area.requiredEvidence.length;
    return Object.freeze({
      id:area.id,order:area.order,title:area.title,status:WAITING,
      pendingRequirements:area.requirementIds.length,
      plannedTasks:area.taskIds.length,requiredEvidence:area.requiredEvidence.length,
    });
  });
  if(requirements.size!==22||plannedTasks!==37||requiredEvidence!==37)invalid();
  return Object.freeze({
    state:'prepared-not-executed',pilotDecision:'NO-GO',launchAuthorized:false,
    founderOnlyNamed:true,
    summary:Object.freeze({areas:areas.length,pendingRequirements:requirements.size,plannedTasks,requiredEvidence}),
    restrictions:Object.freeze({realData:false,externalCalls:false,realPayments:false,featureActivation:false,launch:false}),
    areas:Object.freeze(areas),
  });
}

export async function loadLaunchPreparationSnapshot(
  path=new URL('../../config/launch-preparation.v1.json',import.meta.url),
){
  const plan=JSON.parse(await readFile(path,'utf8'));
  return createLaunchPreparationSnapshot(plan);
}
