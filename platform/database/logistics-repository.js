export function createLogisticsRepository(database) {
  const shipmentColumns = `s.id, s.transaction_id, s.buyer_id, s.seller_id, s.courier_id,
    s.mode, s.insured, s.provider_reference, s.status, s.estimated_delivery_at, s.created_at, s.updated_at`;
  return Object.freeze({
    async context({ buyerId, transactionId, idempotencyKey }) {
      return database.transaction(async (client) => {
        const existing = await client.query(
          `SELECT ${shipmentColumns} FROM shipments s WHERE s.idempotency_key = $1`,
          [idempotencyKey],
        );
        if (existing.rows[0]) return { existing: true, shipment: existing.rows[0] };
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
        const created = await client.query(
          `INSERT INTO shipments
             (transaction_id, buyer_id, seller_id, mode, insured, idempotency_key, status)
           VALUES ($1,$2,$3,$4::shipment_mode,$5,$6,$7::shipment_status)
           ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
           RETURNING *`,
          [input.transactionId, input.buyerId, input.sellerId, input.mode, input.insured,
           input.idempotencyKey, input.mode === "pickup" ? "awaiting_pickup" : "provider_pending"],
        );
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

    async addProof(input) {
      return database.transaction(async (client) => {
        const shipment = await client.query(
          `SELECT id, transaction_id, status FROM shipments
           WHERE id=$1 AND courier_id=$2 FOR UPDATE`,
          [input.shipmentId, input.courierId],
        );
        if (!shipment.rows[0]) return null;
        const proof = await client.query(
          `INSERT INTO delivery_proofs
             (shipment_id,courier_id,media_key,recipient_name,latitude,longitude)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (shipment_id) DO NOTHING RETURNING id,created_at`,
          [input.shipmentId,input.courierId,input.mediaKey,input.recipientName,input.latitude,input.longitude],
        );
        if (!proof.rows[0]) return { duplicate: true };
        await client.query("UPDATE shipments SET status='delivered',updated_at=now() WHERE id=$1",[input.shipmentId]);
        await client.query("UPDATE transactions SET status='completed',updated_at=now() WHERE id=$1",[shipment.rows[0].transaction_id]);
        await client.query(
          `INSERT INTO shipment_events (shipment_id,status,description,latitude,longitude)
           VALUES ($1,'delivered','Entrega comprovada.',$2,$3)`,
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
