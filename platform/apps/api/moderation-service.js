import { ServiceError } from './service-error.js';
import { requireSectorScope,hasSectorScope } from './authorization.js';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const strict=(input,keys)=>input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(key=>keys.includes(key));
function reason(input) { const text=String(input??'').trim(); if(text.length<10||text.length>2000)throw new ServiceError('invalid_moderation_reason',422,'Explique o pedido ou decisão com 10 a 2000 caracteres.'); return text; }
const SANCTIONS=new Set(['warning','functional_restriction','temporary_suspension','permanent_block']);
function sanctionInput(input,{review=false}={}) {
  const keys=review?['action','until','reason','confirmed']:['userId','action','until','reason','confirmed'];
  if(!strict(input,keys)||input.confirmed!==true||!SANCTIONS.has(input.action)||(!review&&!uuid(input.userId)))throw new ServiceError('invalid_moderation_sanction',422,'Confirme uma sanção graduada válida.');
  const until=input.until==null?null:new Date(input.until);
  if((input.action==='temporary_suspension')!==Boolean(until)||until&&(Number.isNaN(until.getTime())||until.getTime()<=Date.now()))throw new ServiceError('invalid_moderation_sanction',422,'Suspensão temporária exige término futuro; outras sanções não recebem término.');
  return{action:input.action,until:until?.toISOString()??null,reason:reason(input.reason)};
}
export function createModerationService(repository) {
  return Object.freeze({
    list(actor) { return repository.list({userId:actor.id,reviewer:hasSectorScope(actor,'admin:moderate')}); },
    detail(actor,decisionId) { if(!uuid(decisionId))throw new ServiceError('moderation_decision_not_found',404,'Decisão não encontrada.'); return repository.detail({userId:actor.id,decisionId,reviewer:hasSectorScope(actor,'admin:moderate')}); },
    appeal(actor,decisionId,input) {
      if(!uuid(decisionId)||!strict(input,['body']))throw new ServiceError('invalid_moderation_appeal',422,'Informe decisão e motivo da contestação.');
      return repository.appeal({userId:actor.id,decisionId,body:reason(input.body)});
    },
    reviewAppeal(actor,decisionId,input) {
      requireSectorScope(actor,'admin:moderate');
      if(!uuid(decisionId)||!strict(input,['outcome','reason','confirmed','reviewedText'])||!['upheld','overturned'].includes(input.outcome)||input.confirmed!==true)throw new ServiceError('invalid_moderation_review',422,'Confirme o resultado e a justificativa da revisão.');
      return repository.reviewAppeal({actorId:actor.id,decisionId,outcome:input.outcome,reason:reason(input.reason),reviewedText:typeof input.reviewedText==='string'&&input.reviewedText.length<=5000?input.reviewedText:undefined});
    },
    suspend(actor,input) {
      requireSectorScope(actor,'admin:moderate');
      if(!strict(input,['userId','reason','until','idempotencyKey'])||!uuid(input.userId)||typeof input.until!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.until)||!Number.isFinite(Date.parse(input.until))||typeof input.idempotencyKey!=='string'||input.idempotencyKey.length<16||input.idempotencyKey.length>128)throw new ServiceError('invalid_moderation_suspension',422,'Informe conta, motivo, término explícito e chave da decisão.');
      return repository.suspend({actorId:actor.id,userId:input.userId,reason:reason(input.reason),until:new Date(input.until).toISOString(),idempotencyKey:input.idempotencyKey});
    },
    proposeSanction(actor,input) {
      if(actor?.role!=='admin'||actor?.staffSector!=='moderation'||actor?.staffAccessLevel!==3)throw new ServiceError('forbidden',403,'Somente moderação nível 3 pode propor sanção.');
      const value=sanctionInput(input);return repository.proposeSanction({actorId:actor.id,userId:input.userId,...value});
    },
    reviewSanction(actor,caseId,input) {
      if(actor?.role!=='admin'||actor?.staffSector!=='moderation'||actor?.staffAccessLevel!==4||!uuid(caseId))throw new ServiceError('forbidden',403,'Somente moderação nível 4 pode revisar a proposta.');
      return repository.reviewSanction({actorId:actor.id,caseId,...sanctionInput(input,{review:true})});
    },
    authorizeSanction(actor,caseId,input) {
      if(actor?.role!=='admin'||actor?.staffSector!=='founder'||actor?.staffAccessLevel!==5||!uuid(caseId))throw new ServiceError('forbidden',403,'Somente o fundador nível 5 pode autorizar a sanção.');
      if(!strict(input,['note','confirmed'])||input.confirmed!==true)throw new ServiceError('invalid_moderation_sanction_authorization',422,'Confirme a autorização final.');
      return repository.authorizeSanction({actorId:actor.id,caseId,note:reason(input.note)});
    },
    executeSanction(actor,caseId,input) {
      if(actor?.role!=='admin'||actor?.staffSector!=='founder'||actor?.staffAccessLevel!==5||!uuid(caseId))throw new ServiceError('forbidden',403,'Somente o fundador nível 5 pode confirmar a execução autorizada.');
      if(!strict(input,['confirmed'])||input.confirmed!==true)throw new ServiceError('invalid_moderation_sanction_execution',422,'Confirme a execução da medida autorizada.');
      return repository.executeSanction({actorId:actor.id,caseId});
    },
  });
}
