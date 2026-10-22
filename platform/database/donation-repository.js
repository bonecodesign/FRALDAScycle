import {verifiedInstitutionRepresentative} from './institution-access-repository.js';
import {requireNewOperations} from './moderation-repository.js';
import {institutionPublicationAllowed} from './institution-publication.js';
import {freePublicationAvailable,lockPremiumAccount} from './premium-repository.js';
import {pilotBhLocation} from '../apps/api/pilot-bh.js';
const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});
async function audit(client,actor,action,id,metadata={}){await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'donation',$3,$4::jsonb)`,[actor,action,id,JSON.stringify(metadata)]);}
async function authorized(client,institutionId,representativeId,{capacityRequired=false}={}){
 const i=(await client.query('SELECT id,status FROM institutions WHERE id=$1 FOR SHARE',[institutionId])).rows[0];
 if(!i||i.status!=='active'||await verifiedInstitutionRepresentative(client,institutionId)!==representativeId)throw fail('donation_institution_authority_pending',409,'A instituição ativa precisa de representante atualmente autorizado.');
 if(capacityRequired){const capacity=(await client.query('SELECT accepting_donations FROM institutions WHERE id=$1 FOR SHARE',[institutionId])).rows[0];if(capacity?.accepting_donations===false)throw fail('donation_institution_capacity_paused',409,'A instituição pausou novas confirmações de doação.');}
}
const columns=`d.transaction_id,d.listing_id,d.institution_id,d.donor_id,d.representative_id,d.version,d.donor_confirmed_at,d.representative_confirmed_at,d.refused_at,d.refused_by,d.refusal_reason,d.refusal_note,d.refusal_evidence_key,d.donor_decision,d.donor_decided_at,d.donor_decision_institution_id,t.status AS transaction_status,l.title,l.status AS listing_status,i.public_name AS institution_name,s.id AS shipment_id,s.status AS shipment_status`;
const joins=`JOIN transactions t ON t.id=d.transaction_id JOIN listings l ON l.id=d.listing_id JOIN institutions i ON i.id=d.institution_id LEFT JOIN shipments s ON s.transaction_id=t.id`;
function exposed(row){return {...row,logisticsResponsibility:'donor',paymentAllowed:false,payoutAllowed:false,externalActionsEnabled:false};}
export function createDonationRepository(database,{pilotBh=null}={}){return Object.freeze({
 async listings(actorId){return database.transaction(async client=>{
  const items=await client.query(`SELECT l.id,l.title,l.institution_id,i.public_name AS institution_name,l.status FROM listings l JOIN institutions i ON i.id=l.institution_id WHERE l.seller_id=$1 AND l.kind='donation' AND l.status='published' ORDER BY l.created_at DESC LIMIT 100`,[actorId]);
  await audit(client,actorId,'donation.listings.read','list');return items.rows;
 });},
 async list(actorId){return database.transaction(async client=>{const items=await client.query(`SELECT ${columns} FROM donation_operations d ${joins} WHERE $1 IN(d.donor_id,d.representative_id) ORDER BY d.donor_confirmed_at DESC LIMIT 100`,[actorId]);await audit(client,actorId,'donations.read','list');return items.rows.map(exposed);});},
 async detail(actorId,transactionId){return database.transaction(async client=>{const item=(await client.query(`SELECT ${columns} FROM donation_operations d ${joins} WHERE d.transaction_id=$1 AND $2 IN(d.donor_id,d.representative_id)`,[transactionId,actorId])).rows[0];if(!item)throw fail('donation_not_found',404,'Doação não encontrada.');await audit(client,actorId,'donation.read',transactionId);return exposed(item);});},
 async create({actorId,listingId,idempotencyKey}){return database.transaction(async client=>{
  const reference=(await client.query(pilotBh?.enabled
    ? `SELECT l.institution_id,l.city,l.state,i.city AS institution_city,i.state AS institution_state
       FROM listings l JOIN institutions i ON i.id=l.institution_id
       WHERE l.id=$1 AND l.seller_id=$2 AND l.kind='donation'`
    : 'SELECT institution_id FROM listings WHERE id=$1 AND seller_id=$2 AND kind=\'donation\'',[listingId,actorId])).rows[0];
  if(!reference)throw fail('donation_listing_not_found',404,'Anúncio de doação não encontrado.');
  if(!pilotBhLocation(pilotBh,reference.city,reference.state)||!pilotBhLocation(pilotBh,reference.institution_city,reference.institution_state))throw fail('pilot_outside_bh',403,'O piloto aceita somente doações em Belo Horizonte, MG.');
  const early=(await client.query(`SELECT d.*,t.status AS transaction_status FROM donation_operations d JOIN transactions t ON t.id=d.transaction_id WHERE d.idempotency_key=$1`,[idempotencyKey])).rows[0];
  if(early){if(early.donor_id!==actorId||early.listing_id!==listingId)throw fail('donation_key_conflict',409,'Chave já usada em outra solicitação.');return {...exposed(early),reused:true};}
  const representative=await verifiedInstitutionRepresentative(client,reference.institution_id);
  if(!representative||representative===actorId)throw fail('donation_institution_authority_pending',409,'A doação exige outro titular como representante autorizado da instituição.');
  await client.query('SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR NO KEY UPDATE',[[actorId,representative]]);
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['donation:'+idempotencyKey]);
  const previous=(await client.query(`SELECT d.*,t.status AS transaction_status FROM donation_operations d JOIN transactions t ON t.id=d.transaction_id WHERE d.idempotency_key=$1`,[idempotencyKey])).rows[0];
  if(previous){if(previous.donor_id!==actorId||previous.listing_id!==listingId)throw fail('donation_key_conflict',409,'Chave já usada em outra solicitação.');return {...exposed(previous),reused:true};}
  await authorized(client,reference.institution_id,representative,{capacityRequired:true});await requireNewOperations(client,actorId);await requireNewOperations(client,representative);
  const listing=(await client.query(`UPDATE listings SET status='unavailable',updated_at=now() WHERE id=$1 AND seller_id=$2 AND kind='donation' AND status='published' AND institution_id=$3 RETURNING id`,[listingId,actorId,reference.institution_id])).rows[0];
  if(!listing)throw fail('donation_listing_unavailable',409,'A doação não está disponível para nova confirmação.');
  const tx=(await client.query("INSERT INTO transactions(listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,'initiated',0) RETURNING id",[listingId,representative,actorId])).rows[0];
  const operation=(await client.query(`INSERT INTO donation_operations(transaction_id,listing_id,institution_id,donor_id,representative_id,idempotency_key,notice_version,logistics_payer_id)
    VALUES($1,$2,$3,$4,$5,$6,'FC-DONATION-1',$4) RETURNING transaction_id,version`,[tx.id,listingId,reference.institution_id,actorId,representative,idempotencyKey])).rows[0];
  await audit(client,actorId,'donation.donor.confirmed',tx.id,{noticeVersion:'FC-DONATION-1',logisticsResponsibility:'donor'});return {...exposed(operation),transaction_status:'initiated',reused:false};
 });},
 async accept({actorId,transactionId,expectedVersion}){return database.transaction(async client=>{
  const tx=(await client.query('SELECT id,status FROM transactions WHERE id=$1 AND buyer_id=$2 FOR UPDATE',[transactionId,actorId])).rows[0];
  if(!tx)throw fail('donation_not_found',404,'Doação não encontrada.');
  const operation=(await client.query('SELECT * FROM donation_operations WHERE transaction_id=$1 AND representative_id=$2 FOR UPDATE',[transactionId,actorId])).rows[0];
  if(!operation)throw fail('donation_not_found',404,'Doação não encontrada.');
  if(operation.version===2&&expectedVersion===1)return {...exposed(operation),transaction_status:tx.status,reused:true};
  if(operation.version!==expectedVersion||tx.status!=='initiated')throw fail('donation_confirmation_conflict',409,'Consulte o estado atual da doação.');
  await client.query('SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR NO KEY UPDATE',[[operation.donor_id,actorId]]);
  await authorized(client,operation.institution_id,actorId,{capacityRequired:true});await requireNewOperations(client,actorId);await requireNewOperations(client,operation.donor_id);
  const accepted=(await client.query('UPDATE donation_operations SET representative_confirmed_at=now(),version=2 WHERE transaction_id=$1 RETURNING transaction_id,version',[transactionId])).rows[0];
  await client.query("UPDATE transactions SET status='donation_confirmed',updated_at=now() WHERE id=$1",[transactionId]);
  await audit(client,actorId,'donation.institution.confirmed',transactionId,{noticeVersion:'FC-DONATION-1'});return {...exposed(accepted),transaction_status:'donation_confirmed',reused:false};
 });},
 async refuse({actorId,transactionId,expectedVersion,reason,note,evidenceKey,idempotencyKey}){return database.transaction(async client=>{
  const tx=(await client.query('SELECT id,status FROM transactions WHERE id=$1 AND buyer_id=$2 FOR UPDATE',[transactionId,actorId])).rows[0];
  if(!tx)throw fail('donation_not_found',404,'Doação não encontrada.');
  const operation=(await client.query('SELECT * FROM donation_operations WHERE transaction_id=$1 AND representative_id=$2 FOR UPDATE',[transactionId,actorId])).rows[0];
  if(!operation)throw fail('donation_not_found',404,'Doação não encontrada.');
  if(operation.version===3){
   const same=operation.refusal_idempotency_key===idempotencyKey&&operation.refusal_reason===reason&&(operation.refusal_note??null)===(note??null)&&(operation.refusal_evidence_key??null)===(evidenceKey??null);
   if(!same)throw fail('donation_refusal_conflict',409,'A doação já possui outra decisão de recusa.');
   return {...exposed(operation),transaction_status:tx.status,reused:true};
  }
  if(operation.version!==expectedVersion||!['initiated','donation_confirmed'].includes(tx.status))throw fail('donation_refusal_conflict',409,'Consulte o estado atual da doação antes de recusar.');
  await authorized(client,operation.institution_id,actorId);
  const shipment=(await client.query('SELECT id,status FROM shipments WHERE transaction_id=$1 FOR UPDATE',[transactionId])).rows[0]??null;
  if(shipment&&!['awaiting_pickup','assigned'].includes(shipment.status))throw fail('donation_refusal_support_required',409,'Após a coleta, a ocorrência deve seguir pelo suporte.');
  const refused=(await client.query(`UPDATE donation_operations SET version=3,refused_at=now(),refused_by=$2,refusal_reason=$3,
    refusal_note=$4,refusal_evidence_key=$5,refusal_idempotency_key=$6 WHERE transaction_id=$1
    RETURNING transaction_id,listing_id,institution_id,donor_id,representative_id,version,refused_at,refused_by,refusal_reason,refusal_note,refusal_evidence_key`,
   [transactionId,actorId,reason,note,evidenceKey,idempotencyKey])).rows[0];
  await client.query("UPDATE transactions SET status='cancelled',updated_at=now() WHERE id=$1",[transactionId]);
  if(shipment){
   await client.query("UPDATE shipments SET status='cancelled',updated_at=now() WHERE id=$1",[shipment.id]);
   await client.query("INSERT INTO shipment_events(shipment_id,status,description) VALUES($1,'cancelled','Doação recusada pela instituição antes da coleta; histórico preservado.')",[shipment.id]);
  }
  await audit(client,actorId,'donation.institution.refused',transactionId,{reason,notePresent:Boolean(note),evidencePresent:Boolean(evidenceKey),previousVersion:expectedVersion,newVersion:3,shipmentId:shipment?.id??null,listingRestored:false});
  return {...exposed(refused),transaction_status:'cancelled',shipment_id:shipment?.id??null,reused:false};
 });},
 async decideAfterRefusal({actorId,transactionId,expectedVersion,decision,targetInstitutionId,idempotencyKey}){return database.transaction(async client=>{
  const operation=(await client.query('SELECT * FROM donation_operations WHERE transaction_id=$1 AND donor_id=$2 FOR UPDATE',[transactionId,actorId])).rows[0];if(!operation)throw fail('donation_not_found',404,'Doação não encontrada.');
  if(operation.version===4){if(operation.donor_decision_idempotency_key===idempotencyKey&&operation.donor_decision===decision&&(operation.donor_decision_institution_id??null)===(targetInstitutionId??null))return {...exposed(operation),reused:true};throw fail('donation_donor_decision_conflict',409,'A decisão do doador já foi registrada.');}
  if(operation.version!==expectedVersion||expectedVersion!==3||!operation.refused_at)throw fail('donation_donor_decision_conflict',409,'A decisão exige uma recusa institucional atual.');
  const tx=(await client.query('SELECT id,status FROM transactions WHERE id=$1 AND seller_id=$2 FOR UPDATE',[transactionId,actorId])).rows[0];if(!tx||tx.status!=='cancelled')throw fail('donation_donor_decision_conflict',409,'A operação não está pronta para esta decisão.');
  const listing=(await client.query('SELECT id,seller_id,kind,status,institution_id,package_condition FROM listings WHERE id=$1 AND seller_id=$2 FOR UPDATE',[operation.listing_id,actorId])).rows[0];if(!listing||listing.status!=='unavailable'||listing.kind!=='donation'||listing.institution_id!==operation.institution_id)throw fail('donation_listing_changed',409,'O anúncio foi alterado e exige suporte.');
  let listingStatus='removed',publicationInstitutionId=operation.institution_id;
  if(['relist','redirect'].includes(decision)){
   if(decision==='redirect'){
    if(!targetInstitutionId||targetInstitutionId===operation.institution_id)throw fail('donation_redirect_institution_invalid',422,'Escolha outra instituição para redirecionar a doação.');
    const representative=await verifiedInstitutionRepresentative(client,targetInstitutionId);if(!representative||representative===actorId)throw fail('donation_redirect_institution_unavailable',409,'A nova instituição precisa estar ativa e possuir outro representante verificado.');publicationInstitutionId=targetInstitutionId;
   }
   if(!await institutionPublicationAllowed(client,{...listing,institution_id:publicationInstitutionId}))throw fail('donation_institution_unavailable',409,'A instituição não permite republicar esta doação.');
   const premium=await lockPremiumAccount(client,actorId);if(!await freePublicationAvailable(client,actorId,premium))throw fail('free_listing_limit',409,'O plano atual não possui vaga para republicar o anúncio.');listingStatus='published';
  }
  await client.query('UPDATE listings SET status=$2::listing_status,institution_id=$3,published_at=CASE WHEN $2=\'published\' THEN now() ELSE published_at END,updated_at=now() WHERE id=$1',[operation.listing_id,listingStatus,publicationInstitutionId]);
  const updated=(await client.query(`UPDATE donation_operations SET version=4,donor_decision=$2,donor_decided_at=now(),donor_decision_idempotency_key=$3,donor_decision_institution_id=$4 WHERE transaction_id=$1 RETURNING *`,[transactionId,decision,idempotencyKey,targetInstitutionId])).rows[0];
  const action={relist:'donation.donor.relisted',redirect:'donation.donor.redirected',close:'donation.donor.closed'}[decision];await audit(client,actorId,action,transactionId,{previousVersion:3,newVersion:4,listingId:operation.listing_id,listingStatus,originalInstitutionId:operation.institution_id,targetInstitutionId:targetInstitutionId??null,refusalPreserved:true});return {...exposed(updated),listing_status:listingStatus,reused:false};
 });},
 async pickup({actorId,transactionId,idempotencyKey}){return database.transaction(async client=>{
  const tx=(await client.query('SELECT id,status FROM transactions WHERE id=$1 AND seller_id=$2 FOR UPDATE',[transactionId,actorId])).rows[0];
  if(!tx)throw fail('donation_not_found',404,'Doação não encontrada.');
  const operation=(await client.query('SELECT * FROM donation_operations WHERE transaction_id=$1 AND donor_id=$2',[transactionId,actorId])).rows[0];
  if(!operation)throw fail('donation_not_found',404,'Doação não encontrada.');
  const previous=(await client.query('SELECT * FROM shipments WHERE idempotency_key=$1',[idempotencyKey])).rows[0];
  function replay(row){if(row.transaction_id!==transactionId||row.seller_id!==actorId||row.mode!=='pickup'||row.logistics_payer_id!==actorId)throw fail('shipment_idempotency_conflict',409,'Chave já usada em outra entrega.');return {id:row.id,status:row.status,reused:true,logisticsResponsibility:'donor',externalActionsEnabled:false};}
  if(previous)return replay(previous);
  if(operation.version!==2||tx.status!=='donation_confirmed')throw fail('donation_logistics_not_ready',409,'Aguarde as duas confirmações da doação.');
  await authorized(client,operation.institution_id,operation.representative_id);
  const existing=(await client.query('SELECT id FROM shipments WHERE transaction_id=$1',[transactionId])).rows[0];if(existing)throw fail('shipment_already_exists',409,'A doação já possui uma entrega.');
  const shipment=(await client.query(`INSERT INTO shipments(transaction_id,buyer_id,seller_id,mode,insured,idempotency_key,status,logistics_payer_id)
   VALUES($1,$2,$3,'pickup',false,$4,'awaiting_pickup',$3) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id,status`,[transactionId,operation.representative_id,actorId,idempotencyKey])).rows[0];
  if(!shipment){const winner=(await client.query('SELECT * FROM shipments WHERE idempotency_key=$1',[idempotencyKey])).rows[0];return replay(winner);}
  await client.query("INSERT INTO shipment_events(shipment_id,status,description) VALUES($1,'awaiting_pickup','Retirada de doação confirmada; logística sob responsabilidade do doador.')",[shipment.id]);
  await audit(client,actorId,'donation.pickup.created',transactionId,{shipmentId:shipment.id,logisticsResponsibility:'donor'});return {...shipment,reused:false,logisticsResponsibility:'donor',externalActionsEnabled:false};
 });}
});}
