import {readFile} from 'node:fs/promises';
import {isMainModule} from '../packages/contracts/main-module.js';

const safePolicy=policy=>policy?.syntheticDataOnly===true&&policy.externalIntegrationsAllowed===false&&policy.realTransactionsAllowed===false&&policy.publicAccessAllowed===false;

export function validatePilotTechnicalPreflight(preflight,evidenceRegister){
  const errors=[];
  if(preflight?.schemaVersion!==1)errors.push('schemaVersion must equal 1');
  if(!safePolicy(preflight?.policy))errors.push('preflight policy must remain synthetic and isolated');
  if(preflight?.humanValidationComplete!==false)errors.push('humanValidationComplete must remain false');
  if(preflight?.launchAuthorized!==false)errors.push('launchAuthorized must remain false');
  const required=new Set((evidenceRegister?.evidence??[]).map(item=>item.id));
  const covered=new Set(preflight?.coveredEvidenceIds??[]),pending=new Set(preflight?.pendingEvidenceIds??[]);
  for(const id of covered)if(pending.has(id))errors.push(`evidence cannot be covered and pending: ${id}`);
  for(const id of [...covered,...pending])if(!required.has(id))errors.push(`unknown evidence: ${id}`);
  for(const id of required)if(!covered.has(id)&&!pending.has(id))errors.push(`unclassified evidence: ${id}`);
  if(covered.size!==19)errors.push('technical coverage must equal 19');
  if(pending.size!==2||!pending.has('screen-reader-check')||!pending.has('rollback-owner'))errors.push('human-only evidence must remain pending');
  return Object.freeze({valid:errors.length===0,errors:Object.freeze(errors),covered:covered.size,pending:pending.size,launchAuthorized:false});
}

export async function inspectPilotTechnicalPreflight(
  preflightPath=new URL('../config/pilot-technical-preflight.v1.json',import.meta.url),
  evidencePath=new URL('../config/pilot-evidence.v1.json',import.meta.url),
){
  const [preflight,evidenceRegister]=await Promise.all([preflightPath,evidencePath].map(path=>readFile(path,'utf8').then(JSON.parse)));
  return {preflight,...validatePilotTechnicalPreflight(preflight,evidenceRegister)};
}

if(isMainModule(import.meta.url)){
  const report=await inspectPilotTechnicalPreflight();
  console.log(JSON.stringify({valid:report.valid,errors:report.errors,covered:report.covered,pending:report.pending,launchAuthorized:false},null,2));
  if(!report.valid)process.exitCode=1;
}
