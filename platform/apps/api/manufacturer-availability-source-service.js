import {requireScope} from './authorization.js';
import {ServiceError} from './service-error.js';
import {classifyManufacturerSource} from '../../packages/contracts/manufacturer-source-governance.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createManufacturerAvailabilitySourceService(repository){return Object.freeze({
  list(actor){requireScope(actor,'admin:catalog:write');return Promise.all([repository.list(),repository.candidates()]).then(([sources,candidates])=>({sources,candidates}));},
  async create(actor,input){requireScope(actor,'admin:catalog:write');let source;try{source=classifyManufacturerSource({sourceUrl:input?.sourceUrl,origin:input?.origin,approved:false,reviewStatus:'pending'});if(source.origin==='discovered')throw Object.assign(new Error('discovered_source_requires_review'),{code:'discovered_source_requires_review'});}catch(error){throw new ServiceError(error.code??'invalid_manufacturer_source',422,'Fonte de disponibilidade inválida.');}return repository.create({actorId:actor.id,sourceUrl:source.sourceUrl,origin:source.origin});},
  decide(actor,id,input){requireScope(actor,'admin:catalog:write');if(!UUID.test(id)||!['approve','reject'].includes(input?.decision)||input?.confirmed!==true)throw new ServiceError('invalid_source_review',422,'Confirme a decisão da fonte.');return repository.decide({actorId:actor.id,id,decision:input.decision,reason:String(input.reason??'').trim().slice(0,1000)});},
  activate(actor,id,input){requireScope(actor,'admin:catalog:write');if(!UUID.test(id)||typeof input?.enabled!=='boolean')throw new ServiceError('invalid_source_activation',422,'Informe o estado da fonte.');return repository.activate({actorId:actor.id,id,enabled:input.enabled});},
});}
