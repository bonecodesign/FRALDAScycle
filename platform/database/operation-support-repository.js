import {institutionPublicationAllowed} from "./institution-publication.js";
import { lockPremiumAccount, freePublicationAvailable } from './premium-repository.js';
const fail = (code, status, message) => Object.assign(new Error(message), { code, status });
export function createOperationSupportRepository(database) {
  return Object.freeze({
    async cancelTransaction({ actorId, transactionId }) {
      return database.transaction(async client => {
        const found = await client.query(
          `SELECT id,listing_id,status,address_shared_at,seller_id,(SELECT kind FROM listings WHERE id=transactions.listing_id) AS kind FROM transactions
           WHERE id=$1 AND $2 IN (buyer_id,seller_id) FOR UPDATE`, [transactionId,actorId]);
        const tx = found.rows[0];
        if (!tx) throw fail('transaction_not_found',404,'Transação não encontrada.');
        if (['completed','cancelled','refunded'].includes(tx.status)) throw fail('transaction_not_cancellable',409,'Operação não pode ser cancelada.');
        const check = await client.query(
          `SELECT EXISTS (
             SELECT 1 FROM shipments s WHERE s.transaction_id=$1 AND
             (s.status IN ('picked_up','in_transit','delivered') OR
              EXISTS (SELECT 1 FROM shipment_events e WHERE e.shipment_id=s.id AND e.status IN ('picked_up','in_transit','delivered')) OR
              EXISTS (SELECT 1 FROM delivery_proofs p WHERE p.shipment_id=s.id))
           ) AS collected,
           EXISTS (SELECT 1 FROM payment_intents WHERE transaction_id=$1) AS has_payment`, [transactionId]);
        const state = check.rows[0];
        if (!state || state.collected !== false || state.has_payment !== false || tx.address_shared_at ||
            !['initiated','payment_pending','proposed','donation_confirmed'].includes(tx.status)) {
          throw fail('cancellation_requires_support',409,'Solicite o cancelamento pelo suporte. A operação pode envolver coleta, endereço compartilhado ou pagamento.');
        }
        await client.query("UPDATE transactions SET status='cancelled',updated_at=now() WHERE id=$1",[transactionId]);
        const premium = await lockPremiumAccount(client, tx.seller_id);
        let nextStatus = await freePublicationAvailable(client, tx.seller_id, premium) ? 'published' : 'paused';
        if(tx.kind==='donation'&&nextStatus==='published'){
          const listing=(await client.query('SELECT kind,institution_id,package_condition FROM listings WHERE id=$1',[tx.listing_id])).rows[0];
          if(!listing||!await institutionPublicationAllowed(client,listing))nextStatus='paused';
        }
        await client.query("UPDATE listings SET status=$2::listing_status,updated_at=now() WHERE id=$1 AND status='unavailable'",[tx.listing_id,nextStatus]);
        await client.query(`INSERT INTO audit_events (actor_user_id,action,entity_type,entity_id,metadata)
          VALUES ($1,'transaction.cancelled','transaction',$2,'{}'::jsonb)`,[actorId,transactionId]);
        return { id:tx.id, listing_id:tx.listing_id, status:'cancelled' };
      });
    },
    async transactionContact({ actorId, transactionId }) {
      return database.transaction(async client => {
        const result=await client.query(`SELECT t.id,t.status,l.kind,
          peer.display_name,peer.email,peer.phone,peer.email_verified_at,peer.phone_verified_at,
          a.unlocked_at,a.revoked_at
          FROM transactions t JOIN listings l ON l.id=t.listing_id
          JOIN transaction_contact_access a ON a.transaction_id=t.id
          JOIN users peer ON peer.id=CASE WHEN t.buyer_id=$2 THEN t.seller_id ELSE t.buyer_id END
          WHERE t.id=$1 AND $2 IN (t.buyer_id,t.seller_id) AND l.kind='sale'
            AND a.revoked_at IS NULL AND t.status NOT IN ('cancelled','refunded')
            AND EXISTS (SELECT 1 FROM payment_intents p WHERE p.id=a.payment_intent_id AND p.status IN ('paid','disputed'))`,[transactionId,actorId]);
        const row=result.rows[0];
        if(!row)throw fail('contact_not_available',409,'O contato fica disponível somente após a confirmação do pagamento.');
        const contact={displayName:row.display_name,unlockedAt:row.unlocked_at};
        if(row.phone_verified_at&&row.phone)contact.phone=row.phone;
        if(row.email_verified_at&&row.email)contact.email=row.email;
        if(!contact.phone&&!contact.email)throw fail('verified_contact_unavailable',409,'A outra parte ainda não possui contato verificado disponível.');
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'transaction.contact.read','transaction',$2,$3::jsonb)`,[actorId,transactionId,JSON.stringify({channels:Object.keys(contact).filter(key=>['phone','email'].includes(key))})]);
        return contact;
      });
    },
    async supportCancellationDecision({ actorId,ticketId,reason }) {
      return database.transaction(async client => {
        const found=await client.query(`SELECT st.id AS ticket_id,st.transaction_id,st.category,st.status AS ticket_status,
          t.status AS transaction_status,p.id AS payment_intent_id,p.amount_cents,p.platform_fee_cents,p.delivery_fee_cents
          FROM support_tickets st JOIN transactions t ON t.id=st.transaction_id
          JOIN payment_intents p ON p.transaction_id=t.id AND p.status='paid'
          WHERE st.id=$1 AND st.category='cancellation'
          ORDER BY p.updated_at DESC LIMIT 1 FOR UPDATE OF st,t,p`,[ticketId]);
        const row=found.rows[0];
        if(!row)throw fail('supported_cancellation_not_available',409,'O pedido precisa estar ligado a uma operação com pagamento confirmado.');
        if(['completed','cancelled','refunded'].includes(row.transaction_status))throw fail('transaction_not_cancellable',409,'A operação já foi encerrada.');
        const existing=await client.query('SELECT * FROM supported_cancellations WHERE transaction_id=$1',[row.transaction_id]);
        if(existing.rows[0])return {cancellation:existing.rows[0],reused:true};
        const refund=row.amount_cents-row.platform_fee_cents-row.delivery_fee_cents;
        const created=await client.query(`INSERT INTO supported_cancellations
          (transaction_id,support_ticket_id,payment_intent_id,decided_by,gross_amount_cents,retained_platform_fee_cents,retained_delivery_fee_cents,refund_amount_cents,reason)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[row.transaction_id,ticketId,row.payment_intent_id,actorId,row.amount_cents,row.platform_fee_cents,row.delivery_fee_cents,refund,reason]);
        await client.query("UPDATE transactions SET status='disputed',updated_at=now() WHERE id=$1",[row.transaction_id]);
        await client.query("UPDATE support_tickets SET status='under_review',updated_at=now() WHERE id=$1",[ticketId]);
        await client.query(`UPDATE transaction_contact_access SET revoked_at=now(),revoked_by=$2,revocation_reason='supported_cancellation'
          WHERE transaction_id=$1 AND revoked_at IS NULL`,[row.transaction_id,actorId]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'transaction.supported_cancellation.decided','transaction',$2,$3::jsonb)`,[actorId,row.transaction_id,JSON.stringify({supportTicketId:ticketId,grossAmountCents:row.amount_cents,retainedPlatformFeeCents:row.platform_fee_cents,retainedDeliveryFeeCents:row.delivery_fee_cents,refundAmountCents:refund})]);
        return {cancellation:created.rows[0],reused:false};
      });
    },
    async createSupportTicket(input) {
      return database.transaction(async client => {
        const existing = await client.query('SELECT * FROM support_tickets WHERE idempotency_key=$1',[input.idempotencyKey]);
        if (existing.rows[0]) {
          if (existing.rows[0].requester_id !== input.requesterId) throw fail('support_key_conflict',409,'Use uma nova chave para este pedido.');
          if(existing.rows[0].category==='receipt_problem'||input.category==='receipt_problem'){
            const occurrence=await client.query('SELECT kind FROM transaction_occurrences WHERE support_ticket_id=$1',[existing.rows[0].id]);
            if(existing.rows[0].category!==input.category||existing.rows[0].transaction_id!==input.transactionId||existing.rows[0].subject!==input.subject||existing.rows[0].details!==input.details||occurrence.rows[0]?.kind!==input.occurrenceKind)throw fail('support_key_conflict',409,'A chave já foi usada para outra ocorrência.');
          }
          return { ticket:existing.rows[0], reused:true };
        }
        let transaction=null;
        if (input.transactionId) {
          const access = await client.query(`SELECT id,status FROM transactions WHERE id=$1 AND $2 IN (buyer_id,seller_id) FOR UPDATE`,[input.transactionId,input.requesterId]);
          transaction=access.rows[0];
          if (!transaction) throw fail('transaction_not_found',404,'Transação não encontrada.');
          if(input.category==='receipt_problem'&&!['paid','in_delivery','completed'].includes(transaction.status))throw fail('occurrence_not_available',409,'A ocorrência exige uma operação paga ou em entrega.');
        }
        const created = await client.query(`INSERT INTO support_tickets
          (requester_id,transaction_id,category,subject,details,idempotency_key)
          VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
          [input.requesterId,input.transactionId,input.category,input.subject,input.details,input.idempotencyKey]);
        if (!created.rows[0]) throw fail('support_key_conflict',409,'Atualize o acompanhamento do pedido ou tente novamente.');
        if(input.category==='receipt_problem'){
          await client.query(`INSERT INTO transaction_occurrences(support_ticket_id,transaction_id,opened_by,kind,prior_transaction_status)
            VALUES($1,$2,$3,$4,$5::transaction_status)`,[created.rows[0].id,input.transactionId,input.requesterId,input.occurrenceKind,transaction.status]);
          await client.query("UPDATE transactions SET status='disputed',updated_at=now() WHERE id=$1 AND status<>'refunded'",[input.transactionId]);
        }
        await client.query(`INSERT INTO audit_events (actor_user_id,action,entity_type,entity_id,metadata)
          VALUES ($1,'support.ticket.created','support_ticket',$2,$3::jsonb)`,
          [input.requesterId,created.rows[0].id,JSON.stringify({category:input.category,...(input.occurrenceKind?{occurrenceKind:input.occurrenceKind}:{})})]);
        return {ticket:created.rows[0],reused:false};
      });
    },
    async supportOccurrenceDecision({actorId,ticketId,outcome,reason}) {
      return database.transaction(async client=>{
        const found=await client.query(`SELECT o.*,t.status AS transaction_status FROM transaction_occurrences o
          JOIN transactions t ON t.id=o.transaction_id WHERE o.support_ticket_id=$1 FOR UPDATE OF o,t`,[ticketId]);
        const occurrence=found.rows[0];
        if(!occurrence)throw fail('occurrence_not_found',404,'Ocorrência não encontrada.');
        if(occurrence.status==='resolved'){
          if(occurrence.outcome!==outcome||occurrence.decision_reason!==reason)throw fail('occurrence_already_decided',409,'A ocorrência já possui outra decisão.');
          return {occurrence,reused:true};
        }
        if(occurrence.transaction_status!=='disputed')throw fail('occurrence_state_conflict',409,'A operação não está bloqueada para decisão.');
        const decided=await client.query(`UPDATE transaction_occurrences SET status='resolved',outcome=$2,decision_reason=$3,decided_by=$4,decided_at=now(),updated_at=now()
          WHERE id=$1 RETURNING *`,[occurrence.id,outcome,reason,actorId]);
        if(outcome==='dismissed')await client.query('UPDATE transactions SET status=$2::transaction_status,updated_at=now() WHERE id=$1',[occurrence.transaction_id,occurrence.prior_transaction_status]);
        await client.query("UPDATE support_tickets SET status='resolved',updated_at=now() WHERE id=$1",[ticketId]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'transaction.occurrence.decided','transaction_occurrence',$2,$3::jsonb)`,[actorId,occurrence.id,JSON.stringify({outcome})]);
        return {occurrence:decided.rows[0],reused:false};
      });
    },
    async supportTickets({userId,reviewer=false,limit=100,offset=0,status=null,category=null,q=null,assignment=null,sort='newest'}) {
      return database.transaction(async client => {
        const result = await client.query(`SELECT st.id,st.protocol,st.category,st.subject,st.status,st.created_at,st.updated_at,
          CASE WHEN $2::boolean THEN st.assignee_id END AS assignee_id,
          CASE WHEN $2::boolean THEN assignee.display_name END AS assignee_name,
          CASE WHEN $2::boolean THEN st.assigned_at END AS assigned_at
          FROM support_tickets st LEFT JOIN users assignee ON assignee.id=st.assignee_id
          WHERE (st.requester_id=$1 OR $2::boolean) AND ($5::text IS NULL OR st.status=$5) AND ($6::text IS NULL OR st.category=$6) AND ($7::text IS NULL OR position(lower($7) in lower(st.protocol::text || ' ' || st.subject || ' ' || st.details))>0) AND ($8::text IS NULL OR ($8='mine' AND st.assignee_id=$1) OR ($8='unassigned' AND st.assignee_id IS NULL)) ORDER BY CASE WHEN $9='oldest' THEN st.created_at END ASC,CASE WHEN $9='oldest' THEN st.id END ASC,CASE WHEN $9='stale' THEN st.updated_at END ASC,CASE WHEN $9='stale' THEN st.id END ASC,CASE WHEN $9='newest' THEN st.created_at END DESC,CASE WHEN $9='newest' THEN st.id END DESC LIMIT $3 OFFSET $4`,[userId,reviewer,limit,offset,status,category,q,assignment,reviewer?sort:'newest']);
        await client.query(`INSERT INTO audit_events (actor_user_id,action,entity_type,entity_id,metadata)
          VALUES ($1,'support.tickets.listed','support_ticket','list',$2::jsonb)`,[userId,JSON.stringify({reviewer,count:result.rows.length,status,category,q,assignment,sort:reviewer?sort:'newest'})]);
        return result.rows;
      });
    },
    async supportTicket({userId,ticketId,reviewer=false}) {
      return database.transaction(async client => {
        const result = await client.query(`SELECT st.*,
          CASE WHEN $3::boolean THEN assignee.display_name END AS assignee_name,
          CASE WHEN $3::boolean THEN st.assignee_id END AS assignee_id,
          CASE WHEN $3::boolean THEN st.assigned_at END AS assigned_at,
          COALESCE($3::boolean AND st.assignee_id=$2,false) AS assigned_to_me FROM support_tickets st
          LEFT JOIN users assignee ON assignee.id=st.assignee_id
          WHERE st.id=$1 AND (st.requester_id=$2 OR $3::boolean)`,[ticketId,userId,reviewer]);
        if (!result.rows[0]) throw fail('support_ticket_not_found',404,'Pedido de suporte não encontrado.');
        const messages = await client.query('SELECT id,body,created_at FROM support_ticket_messages WHERE ticket_id=$1 ORDER BY created_at,id',[ticketId]);
        const internalNotes=reviewer?await client.query(`SELECT n.id,n.ticket_id,n.body,n.created_at,n.author_id,u.display_name AS author_name
          FROM support_ticket_internal_notes n JOIN users u ON u.id=n.author_id WHERE n.ticket_id=$1 ORDER BY n.created_at,n.id`,[ticketId]):null;
        await client.query(`INSERT INTO audit_events (actor_user_id,action,entity_type,entity_id,metadata)
          VALUES ($1,'support.ticket.read','support_ticket',$2,'{}'::jsonb)`,[userId,ticketId]);
        return {...result.rows[0],messages:messages.rows,...(reviewer?{internal_notes:internalNotes.rows}:{})};
      });
    },
    async addSupportNote({actorId,ticketId,body,idempotencyKey}) {
      return database.transaction(async client=>{
        const found=await client.query('SELECT id FROM support_tickets WHERE id=$1 FOR UPDATE',[ticketId]);
        if(!found.rows[0])throw fail('support_ticket_not_found',404,'Pedido de suporte não encontrado.');
        const readExisting=async()=> (await client.query(`SELECT n.id,n.ticket_id,n.body,n.created_at,n.author_id,u.display_name AS author_name
          FROM support_ticket_internal_notes n JOIN users u ON u.id=n.author_id WHERE n.author_id=$1 AND n.idempotency_key=$2`,[actorId,idempotencyKey])).rows[0];
        const replay=async note=>{
          if(note.ticket_id!==ticketId||note.body!==body)throw fail('support_note_key_conflict',409,'A chave já foi usada para outra nota interna. Consulte o protocolo.');
          return {...note,reused:true};
        };
        const existing=await readExisting();if(existing)return replay(existing);
        const created=await client.query(`INSERT INTO support_ticket_internal_notes(ticket_id,author_id,body,idempotency_key)
          VALUES($1,$2,$3,$4) ON CONFLICT(author_id,idempotency_key) DO NOTHING RETURNING id`,[ticketId,actorId,body,idempotencyKey]);
        if(!created.rows[0]){const concurrent=await readExisting();if(!concurrent)throw fail('support_note_key_conflict',409,'Consulte o protocolo antes de reenviar a nota.');return replay(concurrent);}
        await client.query('UPDATE support_tickets SET updated_at=now() WHERE id=$1',[ticketId]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'support.ticket.note_added','support_ticket',$2,'{}'::jsonb)`,[actorId,ticketId]);
        const note=await client.query(`SELECT n.id,n.ticket_id,n.body,n.created_at,n.author_id,u.display_name AS author_name
          FROM support_ticket_internal_notes n JOIN users u ON u.id=n.author_id WHERE n.id=$1`,[created.rows[0].id]);
        return {...note.rows[0],reused:false};
      });
    },
    async replySupportTicket({actorId,ticketId,body,status,idempotencyKey}) {
      return database.transaction(async client => {
        const found = await client.query(`SELECT st.id,st.category,EXISTS(SELECT 1 FROM transaction_occurrences o WHERE o.support_ticket_id=st.id AND o.status='under_review') AS occurrence_pending
          FROM support_tickets st WHERE st.id=$1 FOR UPDATE`,[ticketId]);
        if (!found.rows[0]) throw fail('support_ticket_not_found',404,'Pedido de suporte não encontrado.');
        if(status==='resolved'&&found.rows[0].category==='receipt_problem'&&found.rows[0].occurrence_pending)throw fail('occurrence_decision_required',409,'Registre a decisão da ocorrência antes de encerrar o atendimento.');
        const replay=row=>{
          if(row.ticket_id!==ticketId||row.body!==body||row.requested_status!==status)throw fail('support_reply_key_conflict',409,'A chave já foi usada para outra resposta. Consulte o protocolo.');
          return {id:ticketId,status:row.requested_status,messageId:row.id,reused:true};
        };
        const existing=await client.query('SELECT id,ticket_id,body,requested_status FROM support_ticket_messages WHERE author_id=$1 AND idempotency_key=$2',[actorId,idempotencyKey]);
        if(existing.rows[0])return replay(existing.rows[0]);
        const created=await client.query(`INSERT INTO support_ticket_messages (ticket_id,author_id,body,idempotency_key,requested_status)
          VALUES ($1,$2,$3,$4,$5) ON CONFLICT (author_id,idempotency_key) DO NOTHING RETURNING id`,[ticketId,actorId,body,idempotencyKey,status]);
        if(!created.rows[0]){
          const concurrent=await client.query('SELECT id,ticket_id,body,requested_status FROM support_ticket_messages WHERE author_id=$1 AND idempotency_key=$2',[actorId,idempotencyKey]);
          if(!concurrent.rows[0])throw fail('support_reply_key_conflict',409,'Consulte o protocolo antes de reenviar.');
          return replay(concurrent.rows[0]);
        }
        await client.query('UPDATE support_tickets SET status=$2,updated_at=now() WHERE id=$1',[ticketId,status]);
        await client.query(`INSERT INTO audit_events (actor_user_id,action,entity_type,entity_id,metadata)
          VALUES ($1,'support.ticket.replied','support_ticket',$2,$3::jsonb)`,[actorId,ticketId,JSON.stringify({status})]);
        return {id:ticketId,status,messageId:created.rows[0].id,reused:false};
      });
    },
    async setSupportAssignment({actorId,ticketId,action}) {
      return database.transaction(async client => {
        const found=await client.query('SELECT id,status,assignee_id FROM support_tickets WHERE id=$1 FOR UPDATE',[ticketId]);
        const ticket=found.rows[0];
        if(!ticket)throw fail('support_ticket_not_found',404,'Pedido de suporte não encontrado.');
        let changed=false;
        if(action==='claim'){
          if(ticket.status==='resolved')throw fail('support_ticket_resolved',409,'Um atendimento resolvido não pode ser assumido.');
          if(ticket.assignee_id&&ticket.assignee_id!==actorId)throw fail('support_ticket_assigned',409,'Este atendimento já está atribuído a outra pessoa.');
          if(!ticket.assignee_id){await client.query('UPDATE support_tickets SET assignee_id=$2,assigned_at=now(),updated_at=now() WHERE id=$1',[ticketId,actorId]);changed=true;}
        }else if(action==='release'){
          if(ticket.assignee_id&&ticket.assignee_id!==actorId)throw fail('support_assignment_not_owned',409,'Somente quem assumiu este atendimento pode liberá-lo.');
          if(ticket.assignee_id){await client.query('UPDATE support_tickets SET assignee_id=NULL,assigned_at=NULL,updated_at=now() WHERE id=$1',[ticketId]);changed=true;}
        }
        const result=await client.query(`SELECT st.id,st.assignee_id,assignee.display_name AS assignee_name,st.assigned_at,COALESCE(st.assignee_id=$2,false) AS assigned_to_me
          FROM support_tickets st LEFT JOIN users assignee ON assignee.id=st.assignee_id WHERE st.id=$1`,[ticketId,actorId]);
        if(changed)await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,$2,'support_ticket',$3,$4::jsonb)`,[actorId,action==='claim'?'support.ticket.claimed':'support.ticket.released',ticketId,JSON.stringify({assigneeId:result.rows[0].assignee_id})]);
        return result.rows[0];
      });
    },
  });
}
