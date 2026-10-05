const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});
const gates=Object.freeze({closureAllowed:false,erasureAllowed:false,retentionPolicyStatus:'awaiting_review'});
async function audit(client,actor,action,id,metadata={}){await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'privacy_request',$3,$4::jsonb)`,[actor,action,id,JSON.stringify(metadata)]);}
async function obligations(client,userId){
  const result=await client.query(`SELECT
    (SELECT count(*)::int FROM transactions WHERE $1 IN(buyer_id,seller_id) AND status NOT IN('completed','cancelled','refunded')) AS active_transactions,
    (SELECT count(*)::int FROM payment_cases pc JOIN payment_intents pi ON pi.id=pc.payment_intent_id JOIN transactions t ON t.id=pi.transaction_id WHERE $1 IN(t.buyer_id,t.seller_id) AND pc.status<>'rejected') AS payment_cases,
    (SELECT count(*)::int FROM support_tickets st JOIN transactions t ON t.id=st.transaction_id WHERE $1 IN(t.buyer_id,t.seller_id) AND st.status<>'resolved' AND st.category IN('cancellation','receipt_problem')) AS operational_disputes,
    (SELECT count(*)::int FROM payment_intents pi JOIN transactions t ON t.id=pi.transaction_id WHERE $1 IN(t.buyer_id,t.seller_id)) AS financial_records,
    (SELECT count(*)::int FROM shipment_address_shares WHERE owner_id=$1 OR recipient_id=$1) AS shared_address_records,
    (SELECT count(*)::int FROM transaction_messages WHERE author_id=$1) AS message_records`,[userId]);
  if(!result.rows[0])throw fail('privacy_assessment_unavailable',503,'Não foi possível conferir as pendências.');
  return {...result.rows[0],...gates};
}
export function createPrivacyRequestRepository(database){return Object.freeze({
  async create(input){return database.transaction(async client=>{
    await client.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE',[input.actorId]);
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['privacy:'+input.idempotencyKey]);
    const previous=await client.query(`SELECT p.*,st.protocol FROM privacy_requests p JOIN support_tickets st ON st.id=p.ticket_id WHERE p.idempotency_key=$1`,[input.idempotencyKey]);
    if(previous.rows[0]){const p=previous.rows[0];if(p.requester_id!==input.actorId||p.kind!==input.kind||p.details!==input.details)throw fail('privacy_key_conflict',409,'Chave já utilizada em outra solicitação.');return {id:p.id,kind:p.kind,protocol:p.protocol,status:p.status,version:p.version,reused:true,...gates};}
    const ticket=await client.query(`INSERT INTO support_tickets(requester_id,category,subject,details,idempotency_key) VALUES($1,'privacy',$2,$3,$4) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id,protocol`,[input.actorId,'Solicitação de privacidade: '+input.kind,input.details,'privacy:'+input.idempotencyKey]);
    if(!ticket.rows[0])throw fail('privacy_key_conflict',409,'Chave de suporte já utilizada; registre nova solicitação.');
    const request=await client.query(`INSERT INTO privacy_requests(requester_id,kind,ticket_id,idempotency_key,details) VALUES($1,$2,$3,$4,$5) RETURNING id,kind,status,version`,[input.actorId,input.kind,ticket.rows[0].id,input.idempotencyKey,input.details]);
    await audit(client,input.actorId,'privacy.request.created',request.rows[0].id,{kind:input.kind});return {...request.rows[0],protocol:ticket.rows[0].protocol,reused:false,...gates};
  });},
  async list({actorId,reviewer=false}){return database.transaction(async client=>{
    const items=await client.query(`SELECT p.id,p.kind,p.status,p.version,p.created_at,p.updated_at,st.protocol FROM privacy_requests p JOIN support_tickets st ON st.id=p.ticket_id WHERE p.requester_id=$1 OR $2::boolean ORDER BY p.created_at DESC LIMIT 100`,[actorId,reviewer]);
    await audit(client,actorId,'privacy.requests.listed','list');return items.rows.map(p=>({...p,...gates}));
  });},
  async detail({actorId,requestId,reviewer=false}){return database.transaction(async client=>{
    const found=await client.query(`SELECT p.id,p.requester_id,p.kind,p.details,p.status,p.version,p.created_at,st.protocol FROM privacy_requests p JOIN support_tickets st ON st.id=p.ticket_id WHERE p.id=$1 AND(p.requester_id=$2 OR $3::boolean)`,[requestId,actorId,reviewer]);
    const request=found.rows[0];if(!request)throw fail('privacy_request_not_found',404,'Solicitação não encontrada.');
    const assessment=await client.query('SELECT version,reason,obligations_snapshot,created_at FROM privacy_request_assessments WHERE request_id=$1 ORDER BY version DESC LIMIT 20',[requestId]);
    const live=await obligations(client,request.requester_id);await audit(client,actorId,'privacy.request.read',requestId);
    delete request.requester_id;return {...request,assessments:assessment.rows,currentObligations:live,...gates};
  });},
  async assess({actorId,requestId,expectedVersion,reason}){return database.transaction(async client=>{
    const found=await client.query('SELECT * FROM privacy_requests WHERE id=$1 FOR UPDATE',[requestId]);const request=found.rows[0];
    if(!request)throw fail('privacy_request_not_found',404,'Solicitação não encontrada.');
    if(request.requester_id===actorId)throw fail('privacy_independent_review_required',403,'Outra pessoa autorizada deve analisar o pedido.');
    if(request.version!==expectedVersion){
      const previous=await client.query('SELECT reviewer_id,reason FROM privacy_request_assessments WHERE request_id=$1 AND version=$2',[requestId,expectedVersion+1]);
      if(request.version===expectedVersion+1&&previous.rows[0]?.reviewer_id===actorId&&previous.rows[0]?.reason===reason)return {id:requestId,status:request.status,version:request.version,reused:true,...gates};
      throw fail('privacy_version_conflict',409,'A análise foi atualizada; consulte novamente.');
    }
    const snapshot=await obligations(client,request.requester_id),version=request.version+1;
    await client.query(`INSERT INTO privacy_request_assessments(request_id,reviewer_id,version,reason,obligations_snapshot) VALUES($1,$2,$3,$4,$5::jsonb)`,[requestId,actorId,version,reason,JSON.stringify(snapshot)]);
    await client.query("UPDATE privacy_requests SET status='under_review',version=$2,updated_at=now() WHERE id=$1",[requestId,version]);
    await client.query('INSERT INTO support_ticket_messages(ticket_id,author_id,body) VALUES($1,$2,$3)',[request.ticket_id,actorId,reason]);
    await client.query("UPDATE support_tickets SET status='under_review',updated_at=now() WHERE id=$1",[request.ticket_id]);
    await audit(client,actorId,'privacy.request.assessed',requestId,{kind:request.kind,version,closureAllowed:false,erasureAllowed:false});
    return {id:requestId,status:'under_review',version,reused:false,...gates};
  });}
});}
