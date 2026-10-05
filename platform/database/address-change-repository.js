const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});
const summary=`r.id,r.share_id,r.requester_id,r.expected_revision,r.status,r.created_at,r.reviewed_at,r.review_reason,
  st.protocol,a.shipment_id,COALESCE(v.revision,0) AS current_revision`;
const joins=`JOIN shipment_address_shares a ON a.id=r.share_id JOIN support_tickets st ON st.id=r.ticket_id
  LEFT JOIN LATERAL (SELECT revision,address_snapshot FROM shipment_address_revisions WHERE share_id=a.id ORDER BY revision DESC LIMIT 1) v ON true`;
async function audit(client,actor,action,id,metadata={}) {
  await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'address_change',$3,$4::jsonb)`,[actor,action,id,JSON.stringify(metadata)]);
}
async function lockedShare(client,shareId) {
  const result=await client.query(`SELECT a.*,s.mode,s.status AS shipment_status,s.buyer_id,s.courier_id,t.status AS transaction_status,t.id AS transaction_id,l.kind,
    EXISTS(SELECT 1 FROM shipment_events e WHERE e.shipment_id=s.id AND e.status IN('picked_up','in_transit','delivered')) OR EXISTS(SELECT 1 FROM delivery_proofs dp WHERE dp.shipment_id=s.id) AS collected,
    EXISTS(SELECT 1 FROM payment_intents p WHERE p.transaction_id=t.id AND p.status='paid' AND p.amount_cents=t.amount_cents AND p.provider_reference IS NOT NULL) AS payment_confirmed,
    EXISTS(SELECT 1 FROM payment_cases pc JOIN payment_intents pi ON pi.id=pc.payment_intent_id WHERE pi.transaction_id=t.id AND pc.status<>'rejected') OR
    EXISTS(SELECT 1 FROM support_tickets st WHERE st.transaction_id=t.id AND st.status<>'resolved' AND st.category IN('cancellation','receipt_problem')) AS financial_issue
    FROM shipment_address_shares a JOIN shipments s ON s.id=a.shipment_id JOIN transactions t ON t.id=s.transaction_id JOIN listings l ON l.id=t.listing_id
    WHERE a.id=$1 FOR UPDATE OF a,s,t`,[shareId]);
  return result.rows[0];
}
function eligible(share) {
  if(share.kind!=='sale'||share.collected!==false||share.payment_confirmed!==true||share.financial_issue!==false||!['paid','in_delivery'].includes(share.transaction_status)||!['awaiting_pickup','assigned'].includes(share.shipment_status)) {
    throw fail('address_change_not_allowed',409,'A alteração precisa de análise de ocorrência ou a coleta já foi realizada.');
  }
  const recipient=share.mode==='pickup'?share.buyer_id:share.courier_id;
  if(!recipient||recipient!==share.recipient_id)throw fail('address_recipient_changed',409,'O responsável mudou; não é possível ampliar o consentimento original.');
}
async function current(client,share) {
  const result=await client.query('SELECT revision,address_id,address_snapshot FROM shipment_address_revisions WHERE share_id=$1 ORDER BY revision DESC LIMIT 1',[share.id]);
  return result.rows[0]??{revision:0,address_id:share.address_id,address_snapshot:share.address_snapshot};
}
export function createAddressChangeRepository(database) {
  return Object.freeze({
    async list({actorId,reviewer=false}) {
      return database.transaction(async client=>{
        const r=await client.query(`SELECT ${summary} FROM shipment_address_change_requests r ${joins} WHERE ($2::boolean OR r.requester_id=$1) ORDER BY r.created_at DESC LIMIT 100`,[actorId,reviewer]);
        await audit(client,actorId,'address.change.listed','list');return r.rows;
      });
    },
    async detail({actorId,requestId,reviewer=false}) {
      return database.transaction(async client=>{
        const r=await client.query(`SELECT ${summary},r.reason,r.requested_snapshot,COALESCE(v.address_snapshot,a.address_snapshot) AS current_snapshot
          FROM shipment_address_change_requests r ${joins} WHERE r.id=$1 AND($3::boolean OR r.requester_id=$2)`,[requestId,actorId,reviewer]);
        if(!r.rows[0])throw fail('address_change_not_found',404,'Solicitação não encontrada.');
        await audit(client,actorId,'address.change.read',requestId);return r.rows[0];
      });
    },
    async request(input) {
      return database.transaction(async client=>{
        const share=await lockedShare(client,input.shareId);
        if(!share||share.owner_id!==input.actorId)throw fail('shared_address_not_found',404,'Endereço compartilhado não encontrado.');
        const reused=await client.query(`SELECT r.*,st.protocol FROM shipment_address_change_requests r JOIN support_tickets st ON st.id=r.ticket_id WHERE r.idempotency_key=$1`,[input.idempotencyKey]);
        function replay(row){
          if(row.requester_id!==input.actorId||row.share_id!==input.shareId||row.requested_address_id!==input.addressId||row.expected_revision!==input.expectedRevision||row.reason!==input.reason)throw fail('address_change_idempotency_conflict',409,'Chave já usada em outra solicitação.');
          return {id:row.id,protocol:row.protocol,status:row.status,reused:true};
        }
        if(reused.rows[0])return replay(reused.rows[0]);
        eligible(share);const previous=await current(client,share);
        if(previous.revision!==input.expectedRevision)throw fail('address_revision_conflict',409,'O endereço foi alterado; consulte a versão atual.');
        if(previous.address_id===input.addressId)throw fail('address_unchanged',422,'Selecione um endereço diferente.');
        const owned=await client.query(`SELECT postal_code,street,number,complement,district,city,state FROM addresses WHERE id=$1 AND user_id=$2`,[input.addressId,input.actorId]);
        if(!owned.rows[0])throw fail('address_not_found',404,'Endereço não encontrado.');
        // Serialize keys across different shares too, without writing secrets or raw addresses to audit.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[input.idempotencyKey]);
        const winner=await client.query(`SELECT r.*,st.protocol FROM shipment_address_change_requests r JOIN support_tickets st ON st.id=r.ticket_id WHERE r.idempotency_key=$1`,[input.idempotencyKey]);
        if(winner.rows[0])return replay(winner.rows[0]);
        const ticket=await client.query(`INSERT INTO support_tickets(requester_id,transaction_id,category,subject,details,idempotency_key)
          VALUES($1,$2,'general','Alteração de endereço compartilhado',$3,$4) RETURNING id,protocol`,[input.actorId,share.transaction_id,input.reason,'address-change:'+input.idempotencyKey]);
        const created=await client.query(`INSERT INTO shipment_address_change_requests(share_id,requester_id,requested_address_id,requested_snapshot,expected_revision,notice_version,reason,idempotency_key,ticket_id)
          VALUES($1,$2,$3,$4::jsonb,$5,'FC-ADDRESS-1',$6,$7,$8) RETURNING id,status`,[input.shareId,input.actorId,input.addressId,JSON.stringify(owned.rows[0]),input.expectedRevision,input.reason,input.idempotencyKey,ticket.rows[0].id]);
        await audit(client,input.actorId,'address.change.requested',created.rows[0].id,{shareId:input.shareId,noticeVersion:'FC-ADDRESS-1',expectedRevision:input.expectedRevision});
        return {...created.rows[0],protocol:ticket.rows[0].protocol,reused:false};
      });
    },
    async review({actorId,requestId,outcome,reason}) {
      return database.transaction(async client=>{
        // Read immutable share reference, then use the same share/shipment/transaction lock order as sharing.
        const reference=await client.query('SELECT share_id FROM shipment_address_change_requests WHERE id=$1',[requestId]);
        if(!reference.rows[0])throw fail('address_change_not_found',404,'Solicitação não encontrada.');
        const share=await lockedShare(client,reference.rows[0].share_id);
        const found=await client.query('SELECT * FROM shipment_address_change_requests WHERE id=$1 FOR UPDATE',[requestId]);const request=found.rows[0];
        if(request.requester_id===actorId)throw fail('independent_address_review_required',403,'Outra pessoa autorizada deve analisar a solicitação.');
        if(request.status!=='pending') {
          if(request.status!==outcome||request.review_reason!==reason||request.reviewed_by!==actorId)throw fail('address_review_conflict',409,'A solicitação já foi analisada.');
          return {id:requestId,status:request.status,reused:true};
        }
        if(outcome==='approved') {
          eligible(share);
          // Updating an external carrier route is deliberately unavailable until the provider is homologated.
          if(share.mode!=='pickup')throw fail('address_provider_update_not_configured',503,'A alteração junto ao fornecedor de entrega ainda não foi homologada.');
          const previous=await current(client,share);
          if(previous.revision!==request.expected_revision)throw fail('address_revision_conflict',409,'Outra alteração já foi aprovada; registre novo pedido.');
          await client.query(`INSERT INTO shipment_address_revisions(share_id,revision,request_id,address_id,address_snapshot,approved_by)
            VALUES($1,$2,$3,$4,$5::jsonb,$6)`,[share.id,previous.revision+1,request.id,request.requested_address_id,JSON.stringify(request.requested_snapshot),actorId]);
        }
        await client.query(`UPDATE shipment_address_change_requests SET status=$2,reviewed_by=$3,review_reason=$4,reviewed_at=now() WHERE id=$1`,[requestId,outcome,actorId,reason]);
        await client.query(`INSERT INTO support_ticket_messages(ticket_id,author_id,body) VALUES($1,$2,$3)`,[request.ticket_id,actorId,reason]);
        await client.query(`UPDATE support_tickets SET status='resolved',updated_at=now() WHERE id=$1`,[request.ticket_id]);
        await audit(client,actorId,'address.change.reviewed',requestId,{outcome});return {id:requestId,status:outcome,reused:false};
      });
    },
  });
}
