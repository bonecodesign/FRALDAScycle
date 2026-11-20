import {access,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {isMainModule} from '../packages/contracts/main-module.js';

const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

export async function validateSupportChannelReadiness(plan,root=resolve(import.meta.dirname,'..')){
  const errors=[];
  if(!exact(plan,['schemaVersion','asOf','state','requirementId','policyReference','inApp','email','whatsapp','operations','activation']))errors.push('manifest fields are invalid');
  if(plan?.schemaVersion!==1||plan?.asOf!=='2026-11-20'||plan?.state!=='prepared-not-activated'||plan?.requirementId!==51)errors.push('manifest identity is invalid');
  if(plan?.policyReference!=='docs/decisions/FC-DEC-2026-11-18-canais-suporte-email-chat-app.md')errors.push('approved policy reference is invalid');
  else try{await access(resolve(root,plan.policyReference));}catch{errors.push('approved policy reference is missing');}
  if(!exact(plan?.inApp,['status','protocolConversation','externalDispatch'])
    ||plan?.inApp?.status!=='implemented-local'||plan?.inApp?.protocolConversation!==true
    ||plan?.inApp?.externalDispatch!==false)errors.push('in-app support state is invalid');
  if(!exact(plan?.email,['status','officialDomain','senderAddress','provider','credentialsConfigured','deliveryVerified'])
    ||plan?.email?.status!=='waiting-real-configuration'||plan?.email?.officialDomain!==null
    ||plan?.email?.senderAddress!==null||plan?.email?.provider!==null
    ||plan?.email?.credentialsConfigured!==false||plan?.email?.deliveryVerified!==false)errors.push('email must remain unconfigured');
  if(!exact(plan?.whatsapp,['status','scope','provider','credentialsConfigured','templateApproved','deliveryVerified'])
    ||plan?.whatsapp?.status!=='waiting-real-configuration'||plan?.whatsapp?.scope!=='critical-incidents-only'
    ||plan?.whatsapp?.provider!==null||plan?.whatsapp?.credentialsConfigured!==false
    ||plan?.whatsapp?.templateApproved!==false||plan?.whatsapp?.deliveryVerified!==false)errors.push('whatsapp must remain emergency-only and unconfigured');
  if(!exact(plan?.operations,['staffingAccepted','primaryAssigned','substituteAssigned','privacyApproved','accessibilityVerified','humanExerciseCompleted'])
    ||Object.values(plan?.operations??{}).some(value=>value!==false))errors.push('human operations cannot be claimed');
  if(!exact(plan?.activation,['externalDispatchAuthorized','realStaffingActive','founderAuthorizationRecorded','launchClaimAllowed'])
    ||Object.values(plan?.activation??{}).some(value=>value!==false))errors.push('activation cannot be claimed');
  return Object.freeze({valid:errors.length===0,errors:Object.freeze(errors),requirementId:51,
    state:'prepared-not-activated',inAppReady:plan?.inApp?.status==='implemented-local',
    externalChannelsReady:false,activationAuthorized:false});
}

export async function inspectSupportChannelReadiness(
  path=new URL('../config/support-channel-readiness.v1.json',import.meta.url),
){
  const plan=JSON.parse(await readFile(path,'utf8'));
  return {plan,...await validateSupportChannelReadiness(plan)};
}

if(isMainModule(import.meta.url)){
  try{
    const {plan:unused,...report}=await inspectSupportChannelReadiness();
    console.log(JSON.stringify(report,null,2));
    if(!report.valid)process.exitCode=1;
  }catch{
    console.error(JSON.stringify({valid:false,errors:['unable to validate support channel readiness'],activationAuthorized:false},null,2));
    process.exitCode=1;
  }
}
