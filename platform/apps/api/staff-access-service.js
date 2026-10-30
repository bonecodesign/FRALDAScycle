import {requireAccessLevel} from './authorization.js';
import {ServiceError} from './service-error.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(code,status,message)=>new ServiceError(code,status,message);
const reason=value=>{const text=String(value??'').trim();if(text.length<10||text.length>1000)throw fail('invalid_staff_access_reason',422,'Registre justificativa entre 10 e 1000 caracteres.');return text;};
export function createStaffAccessService(repository){return Object.freeze({
 async list(actor){requireAccessLevel(actor,4);return{items:await repository.list()};},
 async propose(actor,input){requireAccessLevel(actor,4);const requestedLevel=Number(input?.requestedLevel);if(!uuid.test(String(input?.targetUserId??''))||!uuid.test(String(input?.grantId??''))||!Number.isInteger(requestedLevel)||requestedLevel<1||requestedLevel>4)throw fail('invalid_staff_access_change',422,'Solicitação de nível inválida.');return{request:await repository.propose({actorId:actor.id,targetUserId:input.targetUserId,requestedLevel,reason:reason(input.reason),grantId:input.grantId})};},
 async decide(actor,id,input){requireAccessLevel(actor,5);if(!uuid.test(id)||!uuid.test(String(input?.grantId??''))||typeof input?.approved!=='boolean')throw fail('invalid_staff_access_decision',422,'Decisão de nível inválida.');return{request:await repository.decide({actorId:actor.id,requestId:id,approved:input.approved,reason:reason(input.reason),grantId:input.grantId})};},
});}
