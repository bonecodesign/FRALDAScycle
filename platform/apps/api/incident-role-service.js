import {accessLevel,requireAccessLevel} from './authorization.js';
import {ServiceError} from './service-error.js';
const roles=new Set(['technical_lead','technical_substitute','independent_observer']),uuid=/^[0-9a-f-]{36}$/i;
const fail=(code,status,message)=>new ServiceError(code,status,message);
export function createIncidentRoleService(repository){return Object.freeze({
 async list(actor){requireAccessLevel(actor,1);const items=await repository.list();return{canAppoint:accessLevel(actor)===5,items:items.map(item=>({id:item.id,role_kind:item.role_kind,target_name:item.target_name,appointed_by_name:item.appointed_by_name,reason:item.reason,status:item.status,created_at:item.created_at,canDecide:item.status==='pending'&&item.target_user_id===actor.id}))};},
 async appoint(actor,input){requireAccessLevel(actor,5);const targetUserId=String(input?.targetUserId??''),roleKind=String(input?.roleKind??''),reason=String(input?.reason??'').trim(),grantId=String(input?.grantId??'');if(!uuid.test(targetUserId)||!roles.has(roleKind)||reason.length<10||reason.length>500||!uuid.test(grantId))throw fail('invalid_incident_role_appointment',422,'Informe função, conta, justificativa e confirmação válidas.');return{assignment:await repository.appoint({actorId:actor.id,targetUserId,roleKind,reason,grantId})};},
 async decide(actor,id,input){requireAccessLevel(actor,1);const reason=String(input?.reason??'').trim(),grantId=String(input?.grantId??'');if(!uuid.test(id)||typeof input?.accepted!=='boolean'||reason.length<10||reason.length>500||!uuid.test(grantId))throw fail('invalid_incident_role_decision',422,'Informe decisão, justificativa e confirmação válidas.');return{assignment:await repository.decide({actorId:actor.id,assignmentId:id,accepted:input.accepted,reason,grantId})};},
});}
