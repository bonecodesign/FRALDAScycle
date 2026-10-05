import {requireScope} from './authorization.js';
import {ServiceError} from './service-error.js';
import {assertContentAllowed} from './content-guard.js';
const fail=message=>new ServiceError('invalid_review_moderation',422,message);
function strict(input,fields){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.includes(k)))throw fail('Solicitação inválida.');}
function description(value){const text=typeof value==='string'?value.trim():'';if(text.length<10||text.length>2000)throw fail('Informe descrição entre 10 e 2000 caracteres, sem copiar dados privados.');return text;}
function version(value){if(!Number.isSafeInteger(value)||value<0)throw fail('Consulte a versão atual da avaliação.');return value;}
export function createReviewModerationService(repository,moderation){return Object.freeze({
  own(actor){return repository.own(actor.id);},
  list(actor){requireScope(actor,'admin:moderate');return repository.list(actor.id);},
  detail(actor,id){requireScope(actor,'admin:moderate');return repository.detail(actor.id,id);},
  report(actor,reviewId,input){strict(input,['category','details','confirmed']);if(input.confirmed!==true||!['privacy','fraud','offensive'].includes(input.category))throw fail('Escolha o risco e confirme a denúncia.');return repository.report({actorId:actor.id,reviewId,category:input.category,details:description(input.details)});},
  appeal(actor,reviewId,input){strict(input,['details','expectedVersion','confirmed']);if(input.confirmed!==true)throw fail('Confirme a contestação.');return repository.appeal({actorId:actor.id,reviewId,expectedVersion:version(input.expectedVersion),details:description(input.details)});},
  decide(actor,reviewId,input){requireScope(actor,'admin:moderate');strict(input,['outcome','reason','expectedVersion','confirmed']);if(input.confirmed!==true||!['public','removed'].includes(input.outcome))throw fail('Confirme a restauração ou remoção pública.');return repository.decide({actorId:actor.id,reviewId,outcome:input.outcome,expectedVersion:version(input.expectedVersion),reason:description(input.reason),checkContent:r=>assertContentAllowed(moderation,r.author_id,'review',r.comment,r.transaction_id)});}
});}
