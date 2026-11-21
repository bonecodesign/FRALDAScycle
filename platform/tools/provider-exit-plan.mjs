import {readFile} from 'node:fs/promises';
import {PROVIDER_CAPABILITIES} from './provider-contract.mjs';
import {isMainModule} from '../packages/contracts/main-module.js';
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const POLICY_KEYS=['contractReviewed','ownerAssigned','externalExportPerformed','externalDeletionPerformed','credentialsRevoked','continuityTested','exitAuthorized'];
const CAPABILITY_KEYS=['id','candidate','dataClasses','exportRequirement','fallback'];
const EVIDENCE=['contract-exit-terms-review','data-export-report','provider-deletion-receipt','credential-revocation-report','continuity-test-report','founder-decision-record'];
export function validateProviderExitPlan(plan){
 const errors=[];
 if(!exact(plan,['schemaVersion','asOf','state','requirementId','policy','capabilities','requiredEvidence','evidenceReferences']))errors.push('manifest fields are invalid');
 if(plan?.schemaVersion!==1||plan?.asOf!=='2026-11-20'||plan?.state!=='prepared-not-executed'||plan?.requirementId!==60)errors.push('manifest identity is invalid');
 if(!exact(plan?.policy,POLICY_KEYS)||POLICY_KEYS.some(key=>plan.policy?.[key]!==false))errors.push('provider exit cannot claim execution or authorization');
 const capabilities=Array.isArray(plan?.capabilities)?plan.capabilities:[],seen=new Set();
 if(capabilities.length!==PROVIDER_CAPABILITIES.length)errors.push('all provider capabilities are required');
 for(const entry of capabilities){
  if(!exact(entry,CAPABILITY_KEYS)||!PROVIDER_CAPABILITIES.includes(entry?.id)||seen.has(entry?.id)||typeof entry?.candidate!=='string'||!SLUG.test(entry.candidate)||!Array.isArray(entry?.dataClasses)||entry.dataClasses.length<2||entry.dataClasses.some(value=>!SLUG.test(value))||!SLUG.test(entry?.exportRequirement)||!SLUG.test(entry?.fallback))errors.push('provider capability exit plan is invalid');
  else seen.add(entry.id);
 }
 for(const id of PROVIDER_CAPABILITIES)if(!seen.has(id))errors.push('missing provider capability '+id);
 if(JSON.stringify(plan?.requiredEvidence)!==JSON.stringify(EVIDENCE)||!Array.isArray(plan?.evidenceReferences)||plan.evidenceReferences.length!==0)errors.push('exit evidence must remain pending');
 return Object.freeze({valid:errors.length===0,errors:Object.freeze(errors),requirementId:60,capabilities:capabilities.length,state:'prepared-not-executed',exitAuthorized:false,evidenceComplete:false});
}
export async function inspectProviderExitPlan(path=new URL('../config/provider-exit-plan.v1.json',import.meta.url)){const plan=JSON.parse(await readFile(path,'utf8'));return{plan,...validateProviderExitPlan(plan)};}
if(isMainModule(import.meta.url)){try{const{plan:unused,...report}=await inspectProviderExitPlan();console.log(JSON.stringify(report,null,2));if(!report.valid)process.exitCode=1;}catch{console.error(JSON.stringify({valid:false,errors:['unable to validate provider exit plan'],exitAuthorized:false},null,2));process.exitCode=1;}}
