import {hasScope,requireScope} from './authorization.js';
import {ServiceError} from './service-error.js';
const invalid=()=>new ServiceError('invalid_institution_authorization',422,'Confirme o vínculo, sua versão e a justificativa de conferência.');
function strict(input,fields){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.includes(k))||input.confirmed!==true||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)throw invalid();}
function reason(input){const value=typeof input.reason==='string'?input.reason.trim():'';if(value.length<10||value.length>1000)throw invalid();return value;}
export function createInstitutionAccessService(repository){return Object.freeze({
 list(actor){return repository.list({actorId:actor.id,reviewer:hasScope(actor,'admin:institutions:write')});},
 assign(actor,institutionId,input){requireScope(actor,'admin:institutions:write');strict(input,['userId','expectedVersion','reason','confirmed']);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.userId??''))throw invalid();return repository.assign({actorId:actor.id,institutionId,userId:input.userId,expectedVersion:input.expectedVersion,reason:reason(input)});},
 accept(actor,institutionId,input){strict(input,['expectedVersion','confirmed']);return repository.accept({actorId:actor.id,institutionId,expectedVersion:input.expectedVersion});},
 review(actor,institutionId,input){requireScope(actor,'admin:institutions:write');strict(input,['expectedVersion','outcome','reason','confirmed']);if(!['verified','revoked'].includes(input.outcome))throw invalid();return repository.review({actorId:actor.id,institutionId,expectedVersion:input.expectedVersion,outcome:input.outcome,reason:reason(input)});}
});}
