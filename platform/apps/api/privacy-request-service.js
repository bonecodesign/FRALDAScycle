import {hasScope,requireScope} from './authorization.js';
import {ServiceError} from './service-error.js';
function invalid(code,message){return new ServiceError(code,422,message);}
function strict(input,fields){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.includes(k)))throw invalid('invalid_privacy_request','Solicitação inválida.');}
function text(value){return typeof value==='string'?value.trim():'';}
export function createPrivacyRequestService(repository){return Object.freeze({
  list(actor){return repository.list({actorId:actor.id,reviewer:hasScope(actor,'admin:privacy:review')});},
  detail(actor,requestId){return repository.detail({actorId:actor.id,requestId,reviewer:hasScope(actor,'admin:privacy:review')});},
  create(actor,input){strict(input,['kind','details','confirmed','idempotencyKey']);const details=text(input.details);
    if(!['access','correction','deletion'].includes(input.kind)||details.length<10||details.length>2000||typeof input.idempotencyKey!=='string'||input.idempotencyKey.length<16||input.idempotencyKey.length>100)throw invalid('invalid_privacy_request','Escolha acesso, correção ou exclusão e descreva o pedido.');
    if(input.confirmed!==true)throw invalid('privacy_confirmation_required','Confirme que deseja registrar a solicitação no suporte.');
    return repository.create({actorId:actor.id,kind:input.kind,details,idempotencyKey:input.idempotencyKey});
  },
  assess(actor,requestId,input){requireScope(actor,'admin:privacy:review');strict(input,['expectedVersion','reason','confirmed']);const reason=text(input.reason);
    if(input.confirmed!==true||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0||reason.length<10||reason.length>2000)throw invalid('invalid_privacy_assessment','Confirme a análise, sua justificativa e a versão atual.');
    return repository.assess({actorId:actor.id,requestId,expectedVersion:input.expectedVersion,reason});
  }
});}
