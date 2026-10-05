import { ServiceError } from './service-error.js';
import { requireScope,hasScope } from './authorization.js';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const strict=(input,keys)=>input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(key=>keys.includes(key));
function reason(input) { const text=String(input??'').trim(); if(text.length<10||text.length>2000)throw new ServiceError('invalid_moderation_reason',422,'Explique o pedido ou decisão com 10 a 2000 caracteres.'); return text; }
export function createModerationService(repository) {
  return Object.freeze({
    list(actor) { return repository.list({userId:actor.id,reviewer:hasScope(actor,'admin:moderate')}); },
    detail(actor,decisionId) { if(!uuid(decisionId))throw new ServiceError('moderation_decision_not_found',404,'Decisão não encontrada.'); return repository.detail({userId:actor.id,decisionId,reviewer:hasScope(actor,'admin:moderate')}); },
    appeal(actor,decisionId,input) {
      if(!uuid(decisionId)||!strict(input,['body']))throw new ServiceError('invalid_moderation_appeal',422,'Informe decisão e motivo da contestação.');
      return repository.appeal({userId:actor.id,decisionId,body:reason(input.body)});
    },
    reviewAppeal(actor,decisionId,input) {
      requireScope(actor,'admin:moderate');
      if(!uuid(decisionId)||!strict(input,['outcome','reason','confirmed','reviewedText'])||!['upheld','overturned'].includes(input.outcome)||input.confirmed!==true)throw new ServiceError('invalid_moderation_review',422,'Confirme o resultado e a justificativa da revisão.');
      return repository.reviewAppeal({actorId:actor.id,decisionId,outcome:input.outcome,reason:reason(input.reason),reviewedText:typeof input.reviewedText==='string'&&input.reviewedText.length<=5000?input.reviewedText:undefined});
    },
    suspend(actor,input) {
      requireScope(actor,'admin:moderate');
      if(!strict(input,['userId','reason','until','idempotencyKey'])||!uuid(input.userId)||typeof input.until!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.until)||!Number.isFinite(Date.parse(input.until))||typeof input.idempotencyKey!=='string'||input.idempotencyKey.length<16||input.idempotencyKey.length>128)throw new ServiceError('invalid_moderation_suspension',422,'Informe conta, motivo, término explícito e chave da decisão.');
      return repository.suspend({actorId:actor.id,userId:input.userId,reason:reason(input.reason),until:new Date(input.until).toISOString(),idempotencyKey:input.idempotencyKey});
    },
  });
}
