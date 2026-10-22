import { hasScope, requireScope } from './authorization.js';
import { ServiceError } from './service-error.js';
const fail=(code,message)=>new ServiceError(code,422,message);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function strict(input,fields){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.includes(k)))throw fail('invalid_address_change','Solicitação inválida.');}
function reason(input){const value=typeof input.reason==='string'?input.reason.trim():'';if(value.length<10||value.length>1000)throw fail('invalid_address_change_reason','Informe um motivo entre 10 e 1000 caracteres.');return value;}
export function createAddressChangeService(repository){return Object.freeze({
  list(actor){return repository.list({actorId:actor.id,reviewer:hasScope(actor,'admin:support:write')});},
  detail(actor,requestId){return repository.detail({actorId:actor.id,requestId,reviewer:hasScope(actor,'admin:support:write')});},
  request(actor,input){
    strict(input,['shareId','addressId','expectedRevision','confirmed','noticeVersion','reason','idempotencyKey']);
    if(input.confirmed!==true||input.noticeVersion!=='FC-ADDRESS-1')throw fail('address_consent_required','Confirme novamente o aviso de compartilhamento.');
    if(!uuid(input.shareId)||!uuid(input.addressId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||typeof input.idempotencyKey!=='string'||input.idempotencyKey.length<16||input.idempotencyKey.length>100)throw fail('invalid_address_change','Endereço, versão ou chave inválidos.');
    return repository.request({actorId:actor.id,shareId:input.shareId,addressId:input.addressId,expectedRevision:input.expectedRevision,reason:reason(input),idempotencyKey:input.idempotencyKey});
  },
  review(actor,requestId,input){
    requireScope(actor,'admin:support:write');strict(input,['confirmed','outcome','reason']);
    if(input.confirmed!==true||!['approved','rejected'].includes(input.outcome))throw fail('invalid_address_review','Confirme explicitamente o resultado da análise.');
    const providerGate = error => {
      if (error?.code === 'address_provider_update_not_configured' && error?.status === 503) {
        return new ServiceError(error.code,409,error.message);
      }
      return error;
    };
    try {
      return Promise.resolve(repository.review({actorId:actor.id,requestId,outcome:input.outcome,reason:reason(input)}))
        .catch(error => { throw providerGate(error); });
    } catch (error) {
      throw providerGate(error);
    }
  }
});}
