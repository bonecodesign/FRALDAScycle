import {verifiedInstitutionRepresentative} from "./institution-access-repository.js";
import { createReceiptRepository } from "./receipt-repository.js";
import { createAddressChangeRepository } from "./address-change-repository.js";
import { createAddressRepository } from "./address-repository.js";

function conflict(code, message) { return Object.assign(new Error(message), { code, status: 409 }); }
function verifyReplay(row, input) {
  if (row.buyer_id !== input.buyerId || row.transaction_id !== input.transactionId || row.mode !== input.mode || row.insured !== input.insured) {
    throw conflict('shipment_idempotency_conflict', 'Chave de idempotência já utilizada para outra solicitação.');
  }
  return row;
}
export function createLogisticsRepository(database) {
  const shipmentColumns = `s.id, s.transaction_id, s.buyer_id, s.seller_id, s.courier_id,
    s.mode, s.insured, s.provider_reference, s.status, s.estimated_delivery_at, s.created_at, s.updated_at`;
  return Object.freeze({
    ...createReceiptRepository(database),
    ...createAddressRepository(database),
    addressChanges: createAddressChangeRepository(database),
    async courierHistory(courierId,{limit=50,offset=0}={}) {
      const result = await database.query(`SELECT id,status,mode,updated_at
        FROM shipments WHERE courier_id=$1 AND status IN ('delivered','failed','cancelled')
        ORDER BY updated_at DESC,id DESC LIMIT $2 OFFSET $3`, [courierId,limit,offset]);
      return result.rows;
    },
    async courierShipments(courierId,{limit=50,offset=0}={}) {
      const result = await database.query(`SELECT id,status,mode,insured,estimated_delivery_at,created_at
        FROM shipments WHERE courier_id=$1 AND status IN ('assigned','picked_up','in_transit')
        ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`, [courierId,limit,offset]);
      return result.rows;
    },
    async context(input) {
      const { buyerId, transactionId, idempotencyKey } = input;
      return database.transaction(async (client) => {
        const existing = await client.query(
          `SELECT ${shipmentColumns} FROM shipments s WHERE s.idempotency_key = $1`,
          [idempotencyKey],
        );
        if (existing.rows[0]) return { existing: true, shipment: verifyReplay(existing.rows[0], input) };
        const transaction = await client.query(
          `SELECT id, buyer_id, seller_id, status FROM transactions
           WHERE id = $1 AND buyer_id = $2 FOR UPDATE`,
          [transactionId, buyerId],
        );
        return { existing: false, transaction: transaction.rows[0] ?? null };
      });
    },

    async createShipment(input) {
      return database.transaction(async (client) => {
        // Eligibility and idempotency must be checked again under the same lock as insertion.
        const locked = await client.query(
          'SELECT id,buyer_id,seller_id,status FROM transactions WHERE id=$1 AND buyer_id=$2 FOR UPDATE',
          [input.transactionId,input.buyerId],
        );
        if (!locked.rows[0]) throw Object.assign(new Error('Transação não encontrada.'), {code:'transaction_not_found',status:404});
        const replay = await client.query('SELECT * FROM shipments WHERE idempotency_key=$1', [input.idempotencyKey]);
        if (replay.rows[0]) return {...verifyReplay(replay.rows[0], input), reused:true};
        if (!['paid','in_delivery'].includes(locked.rows[0].status)) throw conflict('shipment_not_allowed','Esta transação ainda não permite entrega.');
        if (locked.rows[0].seller_id !== input.sellerId) throw conflict('shipment_not_allowed','A operação foi alterada.');
        const previous = await client.query('SELECT id FROM shipments WHERE transaction_id=$1', [input.transactionId]);
        if (previous.rows[0]) throw conflict('shipment_already_exists','A operação já possui uma entrega.');
        const created = await client.query(
          `INSERT INTO shipments
             (transaction_id, buyer_id, seller_id, mode, insured, idempotency_key, status)
           VALUES ($1,$2,$3,$4::shipment_mode,$5,$6,$7::shipment_status)
           ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
          [input.transactionId, input.buyerId, locked.rows[0].seller_id, input.mode, input.insured,
           input.idempotencyKey, input.mode === "pickup" ? "awaiting_pickup" : "provider_pending"],
        );
        if (!created.rows[0]) {
          const winner = await client.query('SELECT * FROM shipments WHERE idempotency_key=$1', [input.idempotencyKey]);
          return {...verifyReplay(winner.rows[0],input),reused:true};
        }
        await client.query(
          `INSERT INTO shipment_events (shipment_id, status, description)
           VALUES ($1,$2::shipment_status,$3)`,
          [created.rows[0].id, created.rows[0].status,
           input.mode === "pickup" ? "Retirada combinada com o vendedor." : "Entrega solicitada."],
        );
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1,'shipment.created','shipment',$2,$3::jsonb)`,
          [input.buyerId, created.rows[0].id, JSON.stringify({ transactionId: input.transactionId, mode: input.mode, insured: input.insured })],
        );
        return created.rows[0];
      });
    },

    async attachProvider({ shipmentId, providerReference, status, estimatedDeliveryAt }) {
      const result = await database.query(
        `UPDATE shipments SET provider_reference=$2, status=$3::shipment_status,
             estimated_delivery_at=$4, updated_at=now() WHERE id=$1 RETURNING *`,
        [shipmentId, providerReference, status, estimatedDeliveryAt],
      );
      return result.rows[0];
    },

    async detail({ shipmentId, userId }) {
      const result = await database.query(
        `SELECT ${shipmentColumns},
          COALESCE(json_agg(json_build_object(
            'status',e.status,'description',e.description,'latitude',e.latitude,
            'longitude',e.longitude,'occurredAt',e.occurred_at
          ) ORDER BY e.occurred_at, e.id) FILTER (WHERE e.id IS NOT NULL),'[]') AS events
         FROM shipments s LEFT JOIN shipment_events e ON e.shipment_id=s.id
         WHERE s.id=$1 AND $2 IN (s.buyer_id,s.seller_id,s.courier_id)
         GROUP BY s.id`,
        [shipmentId, userId],
      );
      return result.rows[0] ?? null;
    },

    async processWebhook(event) {
      return database.transaction(async (client) => {
        const inserted=await client.query(
          `INSERT INTO logistics_webhook_events
             (id,event_type,provider_reference,occurred_at,payload_hash)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING RETURNING id`,
          [event.id,event.type,event.providerReference,event.occurredAt,event.payloadHash],
        );
        if(!inserted.rows[0])return {duplicate:true};
        const found=await client.query(
          "SELECT id,transaction_id,status FROM shipments WHERE provider_reference=$1 FOR UPDATE",
          [event.providerReference],
        );
        const shipment=found.rows[0];if(!shipment)return {missing:true};
        const next={
          "shipment.assigned":"assigned","shipment.picked_up":"picked_up",
          "shipment.in_transit":"in_transit","shipment.delivered":"delivered",
          "shipment.failed":"failed","shipment.cancelled":"cancelled",
        }[event.type];
        const allowed={
          provider_pending:new Set(["assigned","failed","cancelled"]),
          awaiting_pickup:new Set(["assigned","picked_up","failed","cancelled"]),
          assigned:new Set(["picked_up","in_transit","failed","cancelled"]),
          picked_up:new Set(["in_transit","delivered","failed"]),
          in_transit:new Set(["delivered","failed"]),
          delivered:new Set(),failed:new Set(),cancelled:new Set(),
        };
        if(!allowed[shipment.status]?.has(next))return {ignored:true,status:shipment.status};
        await client.query("UPDATE shipments SET status=$2::shipment_status,updated_at=now() WHERE id=$1",[shipment.id,next]);
        const transactionStatus=["picked_up","in_transit","delivered"].includes(next)?"in_delivery":(next==="failed"||next==="cancelled")?"paid":null;
        // A logistics failure cannot create a paid donation; keep it available for support.
        // Check the listing kind in the same guarded UPDATE so concurrent state changes
        // and protected transaction states cannot be overwritten by a stale webhook.
        if(transactionStatus)await client.query(
          `UPDATE transactions SET status=$2::transaction_status,updated_at=now()
           WHERE id=$1 AND status IN ('paid','donation_confirmed','in_delivery')
             AND ($2::transaction_status <> 'paid' OR EXISTS (
               SELECT 1 FROM listings l
               WHERE l.id=transactions.listing_id AND l.kind <> 'donation'
             ))`,
          [shipment.transaction_id,transactionStatus],
        );
        await client.query(
          `INSERT INTO shipment_events (shipment_id,status,description,latitude,longitude,occurred_at)
           VALUES ($1,$2::shipment_status,$3,$4,$5,$6)`,
          [shipment.id,next,event.description,event.latitude,event.longitude,event.occurredAt],
        );
        await client.query(
          `INSERT INTO audit_events (action,entity_type,entity_id,metadata)
           VALUES ('shipment.webhook.processed','shipment',$1,$2::jsonb)`,
          [shipment.id,JSON.stringify({eventId:event.id,eventType:event.type,status:next})],
        );
        return {duplicate:false,status:next};
      });
    },

    async assignCourier({ shipmentId, courierId }) {
      return database.transaction(async (client) => {
        const assigned = await client.query(
          `UPDATE shipments SET courier_id=$2,status='assigned',updated_at=now()
           WHERE id=$1 AND courier_id IS NULL AND status IN ('awaiting_pickup','assigned')
           RETURNING *`,
          [shipmentId,courierId],
        );
        if (!assigned.rows[0]) return null;
        await client.query(
          `INSERT INTO shipment_events (shipment_id,status,description)
           VALUES ($1,'assigned','Entregador atribuído.')`,
          [shipmentId],
        );
        await client.query(
          `INSERT INTO audit_events (actor_user_id,action,entity_type,entity_id,metadata)
           VALUES ($1,'shipment.courier.assigned','shipment',$2,'{}'::jsonb)`,
          [courierId,shipmentId],
        );
        return assigned.rows[0];
      });
    },

    async collect({shipmentId,courierId}) {
      return database.transaction(async client=>{
        const shipment=(await client.query('SELECT id,transaction_id,status FROM shipments WHERE id=$1 AND courier_id=$2 FOR UPDATE',[shipmentId,courierId])).rows[0];
        if(!shipment)throw Object.assign(new Error('Entrega não atribuída.'),{code:'shipment_not_assigned',status:403});
        const transaction=(await client.query(`SELECT t.id,t.status,l.kind,
          EXISTS(SELECT 1 FROM payment_intents p WHERE p.transaction_id=t.id AND p.status='paid' AND p.amount_cents=t.amount_cents AND p.provider_reference IS NOT NULL) AS payment_confirmed,
          EXISTS(SELECT 1 FROM support_tickets st WHERE st.transaction_id=t.id AND st.status<>'resolved' AND st.category IN('cancellation','receipt_problem')) OR
          EXISTS(SELECT 1 FROM payment_cases pc JOIN payment_intents p ON p.id=pc.payment_intent_id WHERE p.transaction_id=t.id AND pc.status<>'rejected') AS financial_issue
          FROM transactions t JOIN listings l ON l.id=t.listing_id WHERE t.id=$1 FOR UPDATE OF t`,[shipment.transaction_id])).rows[0];
        if(['picked_up','in_transit','delivered'].includes(shipment.status))return {id:shipmentId,status:shipment.status,reused:true};
        let allowed=transaction?.kind==='sale'&&transaction.payment_confirmed===true&&['paid','in_delivery'].includes(transaction.status);
        if(transaction?.kind==='donation'){
          const operation=(await client.query('SELECT institution_id,representative_id,version FROM donation_operations WHERE transaction_id=$1',[shipment.transaction_id])).rows[0];
          if(operation){await client.query('SELECT id FROM institutions WHERE id=$1 FOR SHARE',[operation.institution_id]);allowed=operation.version===2&&await verifiedInstitutionRepresentative(client,operation.institution_id)===operation.representative_id&&transaction.status==='donation_confirmed';}
        }
        if(shipment.status!=='assigned'||!allowed||transaction.financial_issue!==false)throw Object.assign(new Error('A operação não permite registrar a coleta; solicite análise pelo suporte.'),{code:'shipment_collection_not_allowed',status:409});
        await client.query("UPDATE shipments SET status='picked_up',updated_at=now() WHERE id=$1",[shipmentId]);
        await client.query("UPDATE transactions SET status='in_delivery',updated_at=now() WHERE id=$1",[shipment.transaction_id]);
        await client.query("INSERT INTO shipment_events(shipment_id,status,description) VALUES($1,'picked_up','Coleta explicitamente registrada pelo entregador atribuído.')",[shipmentId]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'shipment.collection.recorded','shipment',$2,'{}'::jsonb)`,[courierId,shipmentId]);
        return {id:shipmentId,status:'picked_up',reused:false};
      });
    },

    async courierContact({shipmentId,courierId}) {
      return database.transaction(async client=>{
        const result=await client.query(`SELECT s.id,s.status,
          u.display_name,u.phone,u.phone_verified_at,
          CASE WHEN s.status IN ('assigned','awaiting_pickup') THEN 'pickup' ELSE 'delivery' END AS purpose
          FROM shipments s
          JOIN users u ON u.id=CASE WHEN s.status IN ('assigned','awaiting_pickup') THEN s.seller_id ELSE s.buyer_id END
          JOIN transactions t ON t.id=s.transaction_id
          WHERE s.id=$1 AND s.courier_id=$2
            AND s.status IN ('assigned','picked_up','in_transit')
            AND t.status IN ('paid','in_delivery')
            AND u.phone IS NOT NULL AND u.phone_verified_at IS NOT NULL`,[shipmentId,courierId]);
        const row=result.rows[0];
        if(!row)throw Object.assign(new Error('Contato logístico indisponível para esta etapa.'),{code:'logistics_contact_not_available',status:409});
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'shipment.contact.read','shipment',$2,$3::jsonb)`,[courierId,shipmentId,JSON.stringify({channel:'phone',purpose:row.purpose})]);
        return {displayName:row.display_name,phone:row.phone,purpose:row.purpose};
      });
    },

    async addProof(input) {
      return database.transaction(async (client) => {
        const shipment = await client.query(
          `SELECT id, transaction_id, status FROM shipments
           WHERE id=$1 AND courier_id=$2 FOR UPDATE`,
          [input.shipmentId, input.courierId],
        );
        if (!shipment.rows[0]) return null;
        if (!["picked_up", "in_transit", "delivered"].includes(shipment.rows[0].status)) {
          throw Object.assign(new Error("A entrega ainda não permite comprovante."), {
            code: "shipment_proof_not_allowed", status: 409,
          });
        }
        const proof = await client.query(
          `INSERT INTO delivery_proofs
             (shipment_id,courier_id,media_key,recipient_name,latitude,longitude)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (shipment_id) DO NOTHING RETURNING id,created_at`,
          [input.shipmentId,input.courierId,input.mediaKey,input.recipientName,input.latitude,input.longitude],
        );
        if (!proof.rows[0]) return { duplicate: true };
        await client.query("UPDATE shipments SET status='delivered',updated_at=now() WHERE id=$1",[input.shipmentId]);
        await client.query("UPDATE transactions SET status='in_delivery',updated_at=now() WHERE id=$1 AND status IN ('paid','donation_confirmed','in_delivery')",[shipment.rows[0].transaction_id]);
        await client.query(
          `INSERT INTO shipment_events (shipment_id,status,description,latitude,longitude)
           VALUES ($1,'delivered','Comprovante enviado; aguardando validação e aprovação do recebedor.',$2,$3)`,
          [input.shipmentId,input.latitude,input.longitude],
        );
        await client.query(
          `INSERT INTO audit_events (actor_user_id,action,entity_type,entity_id,metadata)
           VALUES ($1,'shipment.proof.created','shipment',$2,$3::jsonb)`,
          [input.courierId,input.shipmentId,JSON.stringify({ proofId: proof.rows[0].id })],
        );
        return { id: proof.rows[0].id, createdAt: proof.rows[0].created_at, duplicate: false };
      });
    },
  });
}

