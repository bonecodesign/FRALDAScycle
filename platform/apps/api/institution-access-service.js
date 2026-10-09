import {hasScope,requireScope} from './authorization.js';
import {ServiceError} from './service-error.js';
const invalid=()=>new ServiceError('invalid_institution_authorization',422,'Confirme o vínculo, sua versão e a justificativa de conferência.');
const brandInvalid=()=>new ServiceError('invalid_institution_brand_authorization',422,'Informe finalidade, canais, materiais, validade e confirme a autorização.');
function strict(input,fields){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.includes(k))||input.confirmed!==true||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)throw invalid();}
function reason(input){const value=typeof input.reason==='string'?input.reason.trim():'';if(value.length<10||value.length>1000)throw invalid();return value;}
export function createInstitutionAccessService(repository){return Object.freeze({
 list(actor){return repository.list({actorId:actor.id,reviewer:hasScope(actor,'admin:institutions:write')});},
 assign(actor,institutionId,input){requireScope(actor,'admin:institutions:write');strict(input,['userId','expectedVersion','reason','confirmed']);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.userId??''))throw invalid();return repository.assign({actorId:actor.id,institutionId,userId:input.userId,expectedVersion:input.expectedVersion,reason:reason(input)});},
 accept(actor,institutionId,input){strict(input,['expectedVersion','confirmed']);return repository.accept({actorId:actor.id,institutionId,expectedVersion:input.expectedVersion});},
 review(actor,institutionId,input){requireScope(actor,'admin:institutions:write');strict(input,['expectedVersion','outcome','reason','confirmed']);if(!['verified','revoked'].includes(input.outcome))throw invalid();return repository.review({actorId:actor.id,institutionId,expectedVersion:input.expectedVersion,outcome:input.outcome,reason:reason(input)});},
 brandAuthorizations(actor){return repository.brandAuthorizations({actorId:actor.id,reviewer:hasScope(actor,'admin:institutions:read')});},
 authorizeBrand(actor,institutionId,input){
   const allowedChannels=['marketplace','website','app','promotional_materials'],allowedAssets=['public_name','logo','photos','stories'];
   if(!input||input.confirmed!==true||input.noticeVersion!=='FC-INSTITUTION-BRAND-1')throw brandInvalid();
   const purpose=String(input.purpose??'').trim(),channels=[...new Set(Array.isArray(input.channels)?input.channels:[])],assets=[...new Set(Array.isArray(input.assets)?input.assets:[])];
   const validFrom=new Date(input.validFrom),validUntil=new Date(input.validUntil),now=Date.now();
   if(purpose.length<10||purpose.length>500||!channels.length||channels.some(x=>!allowedChannels.includes(x))||!assets.length||assets.some(x=>!allowedAssets.includes(x))||!Number.isFinite(validFrom.getTime())||!Number.isFinite(validUntil.getTime())||validFrom.getTime()<now-300000||validUntil<=validFrom||validUntil.getTime()>validFrom.getTime()+366*24*60*60*1000)throw brandInvalid();
   return repository.authorizeBrand({actorId:actor.id,institutionId,purpose,channels,assets,noticeVersion:input.noticeVersion,validFrom:validFrom.toISOString(),validUntil:validUntil.toISOString()});
 },
 revokeBrand(actor,authorizationId,input){const value=String(input?.reason??'').trim();if(input?.confirmed!==true||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1||value.length<10||value.length>1000)throw brandInvalid();return repository.revokeBrand({actorId:actor.id,authorizationId,expectedVersion:input.expectedVersion,reason:value});}
});}
