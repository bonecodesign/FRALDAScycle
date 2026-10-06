import {ServiceError} from './service-error.js';
const invalid=message=>new ServiceError('invalid_donation',422,message);
function strict(input,fields){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.includes(k))||input.confirmed!==true||input.noticeVersion!=='FC-DONATION-1'||input.logisticsResponsibility!=='donor')throw invalid('Confirme a doação e a responsabilidade do doador pela logística.');}
function key(value){if(typeof value!=='string'||value.length<16||value.length>100)throw invalid('Chave da solicitação inválida.');return value;}
export function createDonationService(repository){return Object.freeze({
 listings(actor){return repository.listings(actor.id);},list(actor){return repository.list(actor.id);},detail(actor,id){return repository.detail(actor.id,id);},
 create(actor,input){strict(input,['listingId','confirmed','noticeVersion','logisticsResponsibility','idempotencyKey']);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.listingId??''))throw invalid('Selecione seu anúncio de doação.');return repository.create({actorId:actor.id,listingId:input.listingId,idempotencyKey:key(input.idempotencyKey)});},
 accept(actor,id,input){strict(input,['expectedVersion','confirmed','noticeVersion','logisticsResponsibility']);if(input.expectedVersion!==1)throw invalid('Consulte a versão da doação pendente.');return repository.accept({actorId:actor.id,transactionId:id,expectedVersion:input.expectedVersion});},
 pickup(actor,id,input){strict(input,['confirmed','noticeVersion','logisticsResponsibility','idempotencyKey']);return repository.pickup({actorId:actor.id,transactionId:id,idempotencyKey:key(input.idempotencyKey)});}
});}
