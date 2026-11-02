import {accessLevel} from './authorization.js';
import {ServiceError} from './service-error.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,fail=(code,status,message)=>new ServiceError(code,status,message);
const note=value=>{const text=String(value??'').trim();if(text.length<10||text.length>1000)throw fail('invalid_retention_request_note',422,'Registre justificativa entre 10 e 1000 caracteres.');return text;};
const batch=value=>{const limit=Number(value);if(!Number.isInteger(limit)||limit<1||limit>100)throw fail('invalid_retention_request_limit',422,'O lote deve ficar entre 1 e 100 registros.');return limit;};
export function createExchangeRetentionRequestService(repository){return Object.freeze({
 async list(actor){const level=accessLevel(actor);if(level<3)throw fail('insufficient_access_level',403,'Acesso mínimo de nível 3 necessário.');return{items:await repository.manualRequests(),canRequest:level===3,canReview:level===4};},
 async request(actor,input){if(accessLevel(actor)!==3)throw fail('insufficient_access_level',403,'Somente nível 3 pode solicitar.');return{request:await repository.requestManualRun({actorId:actor.id,limit:batch(input?.limit),justification:note(input?.justification)}),directExecution:false};},
 async review(actor,id,input){if(accessLevel(actor)!==4)throw fail('insufficient_access_level',403,'Somente nível 4 pode revisar.');if(!uuid.test(id)||typeof input?.approved!=='boolean')throw fail('invalid_retention_review',422,'Decisão de retenção inválida.');return{request:await repository.reviewManualRun({actorId:actor.id,requestId:id,approved:input.approved,approvedLimit:input.approved?batch(input?.approvedLimit):null,note:note(input?.note)}),directExecution:false};}
});}
