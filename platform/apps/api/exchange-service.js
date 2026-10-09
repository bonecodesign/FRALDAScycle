import {hasScope,requireScope} from './authorization.js';
import {ServiceError} from './service-error.js';
const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value??'');
const invalid=()=>new ServiceError('invalid_exchange',422,'Informe os dois anúncios e confirme a operação de troca.');
export function createExchangeService(repository){return Object.freeze({
 propose(actor,input){if(input?.confirmed!==true||!uuid(input.requestedListingId)||!uuid(input.offeredListingId)||input.requestedListingId===input.offeredListingId)throw invalid();return repository.propose({actorId:actor.id,requestedListingId:input.requestedListingId,offeredListingId:input.offeredListingId});},
 accept(actor,transactionId,input){if(!uuid(transactionId)||input?.confirmed!==true||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1)throw invalid();return repository.accept({actorId:actor.id,transactionId,expectedVersion:input.expectedVersion});},
 refuse(actor,transactionId,input){const reason=String(input?.reason??'').trim();if(!uuid(transactionId)||input?.confirmed!==true||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1||reason.length<10||reason.length>1000)throw invalid();return repository.refuse({actorId:actor.id,transactionId,expectedVersion:input.expectedVersion,reason});},
 cancel(actor,transactionId,input){const reason=String(input?.reason??'').trim();if(!uuid(transactionId)||input?.confirmed!==true||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1||reason.length<10||reason.length>1000)throw invalid();return repository.confirmCancellation({actorId:actor.id,transactionId,expectedVersion:input.expectedVersion,reason});},
 async detail(actor,transactionId){if(!uuid(transactionId))throw invalid();const operation=await repository.detail({actorId:actor.id,transactionId,reviewer:hasScope(actor,'admin:deliveries:validate')});if(!operation)throw new ServiceError('exchange_not_found',404,'Troca não encontrada.');return operation;},
 complete(actor,transactionId,input){requireScope(actor,'admin:deliveries:validate');if(!uuid(transactionId)||input?.confirmed!==true)throw invalid();return repository.complete({actorId:actor.id,transactionId});}
});}
