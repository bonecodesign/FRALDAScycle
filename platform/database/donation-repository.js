import {verifiedInstitutionRepresentative} from './institution-access-repository.js';
import {requireNewOperations} from './moderation-repository.js';
const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});
async function audit(client,actor,action,id,metadata={}){await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'donation',$3,$4::jsonb)`,[actor,action,id,JSON.stringify(metadata)]);}
async function authorized(client,institutionId,representativeId){
 const i=(await client.query('SELECT id,status FROM institutions WHERE id=$1 FOR SHARE',[institutionId])).rows[0];
 if(!i||i.status!=='active'||await verifiedInstitutionRepresentative(client,institutionId)!==representativeId)throw fail('donation_institution_authority_pending',409,'A instituição ativa precisa de representante atualmente autorizado.');
}
const columns=`d.transaction_id,d.listing_id,d.institution_id,d.donor_id,d.representative_id,d.version,d.donor_confirmed_at,d.representative_confirmed_at,t.status AS transaction_status,l.title,i.public_name AS institution_name,s.id AS shipment_id`;
const joins=`JOIN transactions t ON t.id=d.transaction_id JOIN listings l ON l.id=d.listing_id JOIN institutions i ON i.id=d.institution_id LEFT JOIN shipments s ON s.transaction_id=t.id`;
function exposed(row){return {...row,logisticsResponsibility:'donor',paymentAllowed:false,payoutAllowed:false,externalActionsEnabled:false};}
export function createDonationRepository(database){return Object.freeze({
 async listings(actorId){return database.transaction(async client=>{
  const items=await client.query(`SELECT l.id,l.title,l.institution_id,i.public_name AS institution_name,l.status FROM listings l JOIN institutions i ON i.id=l.institution_id WHERE l.seller_id=$1 AND l.kind='donation' AND l.status='published' ORDER BY l.created_at DESC LIMIT 100`,[actorId]);
  await audit(client,actorId,'donation.listings.read','list');return items.rows;
 });},
 async list(actorId){return database.transaction(async client=>{const items=await client.query(`SELECT ${columns} FROM donation_operations d ${joins} WHERE $1 IN(d.donor_id,d.representative_id) ORDER BY d.donor_confirmed_at DESC LIMIT 100`,[actorId]);await audit(client,actorId,'donations.read','list');return items.rows.map(exposed);});},
 async detail(actorId,transactionId){return database.transaction(async client=>{const item=(await client.query(`SELECT ${columns} FROM donation_operations d ${joins} WHERE d.transaction_id=$1 AND $2 IN(d.donor_id,d.representative_id)`,[transactionId,actorId])).rows[0];if(!item)throw fail('donation_not_found',404,'Doação não encontrada.');await audit(client,actorId,'donation.read',transactionId);return exposed(item);});},
 async create({actorId,listingId,idempotencyKey}){return database.transaction(async client=>{
  const reference=(await client.query('SELECT institution_id FROM listings WHERE id=$1 AND seller_id=$2 AND kind=\'donation\'',[listingId,actorId])).rows[0];
  if(!reference)throw fail('donation_listing_not_found',404,'Anúncio de doação não encontrado.');
  const early=(await client.query(`SELECT d.*,t.status AS transaction_status FROM donation_operations d JOIN transactions t ON t.id=d.transaction_id WHERE d.idempotency_key=$1`,[idempotencyKey])).rows[0];
  if(early){if(early.donor_id!==actorId||early.listing_id!==listingId)throw fail('donation_key_conflict',409,'Chave já usada em outra solicitação.');return {...exposed(early),reused:true};}
  const representative=await verifiedInstitutionRepresentative(client,reference.institution_id);
  if(!representative||representative===actorId)throw fail('donation_institution_authority_pending',409,'A doação exige outro titular como representante autorizado da instituição.');
  await client.query('SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR NO KEY UPDATE',[[actorId,representative]]);
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['donation:'+idempotencyKey]);
  const previous=(await client.query(`SELECT d.*,t.status AS transaction_status FROM donation_operations d JOIN transactions t ON t.id=d.transaction_id WHERE d.idempotency_key=$1`,[idempotencyKey])).rows[0];
  if(previous){if(previous.donor_id!==actorId||previous.listing_id!==listingId)throw fail('donation_key_conflict',409,'Chave já usada em outra solicitação.');return {...exposed(previous),reused:true};}
  await authorized(client,reference.institution_id,representative);await requireNewOperations(client,actorId);await requireNewOperations(client,representative);
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
  await authorized(client,operation.institution_id,actorId);await requireNewOperations(client,actorId);await requireNewOperations(client,operation.donor_id);
  const accepted=(await client.query('UPDATE donation_operations SET representative_confirmed_at=now(),version=2 WHERE transaction_id=$1 RETURNING transaction_id,version',[transactionId])).rows[0];
  await client.query("UPDATE transactions SET status='donation_confirmed',updated_at=now() WHERE id=$1",[transactionId]);
  await audit(client,actorId,'donation.institution.confirmed',transactionId,{noticeVersion:'FC-DONATION-1'});return {...exposed(accepted),transaction_status:'donation_confirmed',reused:false};
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
