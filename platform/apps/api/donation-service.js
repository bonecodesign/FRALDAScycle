import {ServiceError} from './service-error.js';
const invalid=message=>new ServiceError('invalid_donation',422,message);
export const DONATION_REFUSAL_REASONS=Object.freeze(['sanitary_condition','outside_scope','insufficient_expiry','institution_capacity','listing_mismatch','other']);
const refusalReasons=new Set(DONATION_REFUSAL_REASONS);
function strict(input,fields){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.includes(k))||input.confirmed!==true||input.noticeVersion!=='FC-DONATION-2'||input.logisticsResponsibility!=='institution')throw invalid('Confirme a doação e a responsabilidade da instituição pela retirada.');}
function key(value){if(typeof value!=='string'||value.length<16||value.length>100)throw invalid('Chave da solicitação inválida.');return value;}
function refusal(input){
 const fields=['expectedVersion','confirmed','reason','note','evidenceKey','idempotencyKey'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.includes(k))||input.confirmed!==true)throw invalid('Confirme expressamente a recusa da doação.');
 if(![1,2].includes(input.expectedVersion))throw invalid('Consulte a versão atual da doação antes de recusar.');
 if(!refusalReasons.has(input.reason))throw invalid('Escolha um motivo válido para a recusa.');
 const note=String(input.note??'').trim();
 if(note.length>500||(input.reason==='other'&&note.length<10))throw invalid('Descreva o outro motivo entre 10 e 500 caracteres.');
 const evidenceKey=input.evidenceKey==null||input.evidenceKey===''?null:String(input.evidenceKey);
 if(evidenceKey!==null&&(!/^[a-zA-Z0-9/_.-]{8,500}$/.test(evidenceKey)||evidenceKey.includes('..')))throw invalid('A referência privada da evidência é inválida.');
 return {expectedVersion:input.expectedVersion,reason:input.reason,note:note||null,evidenceKey,idempotencyKey:key(input.idempotencyKey)};
}
export function createDonationService(repository){return Object.freeze({
 listings(actor){return repository.listings(actor.id);},list(actor){return repository.list(actor.id);},detail(actor,id){return repository.detail(actor.id,id);},
 create(actor,input){strict(input,['listingId','confirmed','noticeVersion','logisticsResponsibility','idempotencyKey']);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.listingId??''))throw invalid('Selecione seu anúncio de doação.');return repository.create({actorId:actor.id,listingId:input.listingId,idempotencyKey:key(input.idempotencyKey)});},
 accept(actor,id,input){strict(input,['expectedVersion','confirmed','noticeVersion','logisticsResponsibility']);if(input.expectedVersion!==1)throw invalid('Consulte a versão da doação pendente.');return repository.accept({actorId:actor.id,transactionId:id,expectedVersion:input.expectedVersion});},
 refuse(actor,id,input){return repository.refuse({actorId:actor.id,transactionId:id,...refusal(input)});},
 decide(actor,id,input){const decision=String(input?.decision??''),targetInstitutionId=String(input?.targetInstitutionId??'').trim()||null;if(!input||Object.keys(input).some(k=>!['expectedVersion','decision','targetInstitutionId','confirmed','idempotencyKey'].includes(k))||input.confirmed!==true||input.expectedVersion!==3||!['relist','redirect','close'].includes(decision)||(decision==='redirect'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetInstitutionId??''))||(decision!=='redirect'&&targetInstitutionId))throw invalid('Escolha republicar, redirecionar ou encerrar e confirme a decisão.');return repository.decideAfterRefusal({actorId:actor.id,transactionId:id,expectedVersion:3,decision,targetInstitutionId,idempotencyKey:key(input.idempotencyKey)});},
 pickup(actor,id,input){strict(input,['confirmed','noticeVersion','logisticsResponsibility','idempotencyKey']);return repository.pickup({actorId:actor.id,transactionId:id,idempotencyKey:key(input.idempotencyKey)});}
});}
