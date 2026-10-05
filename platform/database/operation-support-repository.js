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
    async createSupportTicket(input) {
      return database.transaction(async client => {
        const existing = await client.query('SELECT * FROM support_tickets WHERE idempotency_key=$1',[input.idempotencyKey]);
        if (existing.rows[0]) {
          if (existing.rows[0].requester_id !== input.requesterId) throw fail('support_key_conflict',409,'Use uma nova chave para este pedido.');
          return { ticket:existing.rows[0], reused:true };
        }
        if (input.transactionId) {
          const access = await client.query(`SELECT id FROM transactions WHERE id=$1 AND $2 IN (buyer_id,seller_id) FOR UPDATE`,[input.transactionId,input.requesterId]);
          if (!access.rows[0]) throw fail('transaction_not_found',404,'Transação não encontrada.');
        }
        const created = await client.query(`INSERT INTO support_tickets
          (requester_id,transaction_id,category,subject,details,idempotency_key)
          VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
          [input.requesterId,input.transactionId,input.category,input.subject,input.details,input.idempotencyKey]);
        if (!created.rows[0]) throw fail('support_key_conflict',409,'Atualize o acompanhamento do pedido ou tente novamente.');
        await client.query(`INSERT INTO audit_events (actor_user_id,action,entity_type,entity_id,metadata)
          VALUES ($1,'support.ticket.created','support_ticket',$2,$3::jsonb)`,
          [input.requesterId,created.rows[0].id,JSON.stringify({category:input.category})]);
        return {ticket:created.rows[0],reused:false};
      });
    },
    async supportTickets({userId,reviewer=false}) {
      return database.transaction(async client => {
        const result = await client.query(`SELECT id,protocol,category,subject,status,created_at,updated_at
          FROM support_tickets WHERE requester_id=$1 OR $2::boolean ORDER BY created_at DESC LIMIT 100`,[userId,reviewer]);
        await client.query(`INSERT INTO audit_events (actor_user_id,action,entity_type,entity_id,metadata)
          VALUES ($1,'support.tickets.listed','support_ticket','list',$2::jsonb)`,[userId,JSON.stringify({reviewer,count:result.rows.length})]);
        return result.rows;
      });
    },
    async supportTicket({userId,ticketId,reviewer=false}) {
      return database.transaction(async client => {
        const result = await client.query('SELECT * FROM support_tickets WHERE id=$1 AND (requester_id=$2 OR $3::boolean)',[ticketId,userId,reviewer]);
        if (!result.rows[0]) throw fail('support_ticket_not_found',404,'Pedido de suporte não encontrado.');
        const messages = await client.query('SELECT id,body,created_at FROM support_ticket_messages WHERE ticket_id=$1 ORDER BY created_at,id',[ticketId]);
        await client.query(`INSERT INTO audit_events (actor_user_id,action,entity_type,entity_id,metadata)
          VALUES ($1,'support.ticket.read','support_ticket',$2,'{}'::jsonb)`,[userId,ticketId]);
        return {...result.rows[0],messages:messages.rows};
      });
    },
    async replySupportTicket({actorId,ticketId,body,status}) {
      return database.transaction(async client => {
        const found = await client.query('SELECT id FROM support_tickets WHERE id=$1 FOR UPDATE',[ticketId]);
        if (!found.rows[0]) throw fail('support_ticket_not_found',404,'Pedido de suporte não encontrado.');
        await client.query('INSERT INTO support_ticket_messages (ticket_id,author_id,body) VALUES ($1,$2,$3)',[ticketId,actorId,body]);
        await client.query('UPDATE support_tickets SET status=$2,updated_at=now() WHERE id=$1',[ticketId,status]);
        await client.query(`INSERT INTO audit_events (actor_user_id,action,entity_type,entity_id,metadata)
          VALUES ($1,'support.ticket.replied','support_ticket',$2,$3::jsonb)`,[actorId,ticketId,JSON.stringify({status})]);
        return {id:ticketId,status};
      });
    },
  });
}
