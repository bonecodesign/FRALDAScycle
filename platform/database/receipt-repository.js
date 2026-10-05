function failure(code, status, message) {
  return Object.assign(new Error(message), { code, status });
}

export function createReceiptRepository(database) {
  return Object.freeze({
    async receiptEvidence({ userId, shipmentId, reviewer = false }) {
      return database.transaction(async (client) => {
        const result = await client.query(
          `SELECT p.id, p.media_key, p.courier_id, p.created_at,
                  a.approved_at, v.validated_at, s.status AS shipment_status,
                  t.status AS transaction_status, l.kind,
                  (SELECT count(*)::integer FROM payment_intents pi
                   WHERE pi.transaction_id=t.id AND pi.status='paid') AS paid_count,
                  EXISTS (SELECT 1 FROM payment_intents pi
                          WHERE pi.transaction_id=t.id AND
                            (pi.status IN ('disputed','refunded','provider_pending','pending','authorized')
                             OR (pi.status='paid' AND (pi.amount_cents IS DISTINCT FROM t.amount_cents
                                 OR pi.amount_cents <= 0 OR pi.provider_reference IS NULL)))) AS payment_blocked,
                  EXISTS (SELECT 1 FROM payment_cases pc JOIN payment_intents pi ON pi.id=pc.payment_intent_id
                          WHERE pi.transaction_id=t.id AND pc.status <> 'rejected') OR
                  EXISTS (SELECT 1 FROM support_tickets st WHERE st.transaction_id=t.id
                          AND st.category IN ('cancellation','receipt_problem') AND st.status <> 'resolved') AS financial_case_pending
           FROM shipments s JOIN transactions t ON t.id=s.transaction_id
           JOIN listings l ON l.id=t.listing_id
           JOIN delivery_proofs p ON p.shipment_id=s.id
           LEFT JOIN delivery_receipt_approvals a ON a.proof_id=p.id
           LEFT JOIN delivery_proof_validations v ON v.proof_id=p.id
           WHERE s.id=$1 AND ($3::boolean OR $2 IN (s.buyer_id,s.seller_id,s.courier_id))`,
          [shipmentId, userId, reviewer],
        );
        if (!result.rows[0]) return null;
        await client.query(
          `INSERT INTO audit_events (actor_user_id,action,entity_type,entity_id,metadata)
           VALUES ($1,'shipment.proof.read','shipment',$2,$3::jsonb)`,
          [userId, shipmentId, JSON.stringify({ proofId: result.rows[0].id })],
        );
        return result.rows[0];
      });
    },

    async recordReceiptDecision({ actorId, shipmentId, validation = false, reason = null }) {
      return database.transaction(async (client) => {
        const context = await client.query(
          `SELECT s.status, s.buyer_id, s.seller_id, s.courier_id,
                  t.status AS transaction_status, l.kind, p.id AS proof_id
           FROM shipments s JOIN transactions t ON t.id=s.transaction_id
           JOIN listings l ON l.id=t.listing_id
           LEFT JOIN delivery_proofs p ON p.shipment_id=s.id
           WHERE s.id=$1 FOR UPDATE OF s,t`, [shipmentId],
        );
        const row = context.rows[0];
        if (!row || (!validation && row.buyer_id !== actorId)) {
          throw failure("receipt_not_found", 404, "Recebimento não encontrado.");
        }
        if (validation && [row.buyer_id, row.seller_id, row.courier_id].includes(actorId)) {
          throw failure("independent_validation_required", 403, "A validação deve ser feita por administrador sem participação na entrega.");
        }
        if (row.kind !== "sale") {
          throw failure("receipt_flow_not_configured", 503, "A confirmação de troca ou doação ainda não está disponível.");
        }
        if (row.status !== "delivered" || !row.proof_id || row.transaction_status !== "in_delivery") {
          throw failure("receipt_not_ready", 409, "Aguarde a entrega e o envio do comprovante.");
        }
        const table = validation ? "delivery_proof_validations" : "delivery_receipt_approvals";
        const result = validation
          ? await client.query(`INSERT INTO delivery_proof_validations (proof_id,validator_id,reason)
              VALUES ($1,$2,$3) ON CONFLICT (proof_id) DO NOTHING RETURNING validated_at AS recorded_at`,
            [row.proof_id, actorId, reason])
          : await client.query(`INSERT INTO delivery_receipt_approvals (proof_id,approver_id)
              VALUES ($1,$2) ON CONFLICT (proof_id) DO NOTHING RETURNING approved_at AS recorded_at`,
            [row.proof_id, actorId]);
        if (!result.rows[0]) {
          const existing = await client.query(
            `SELECT ${validation ? "validated_at" : "approved_at"} AS recorded_at FROM ${table} WHERE proof_id=$1`,
            [row.proof_id],
          );
          return { recordedAt: existing.rows[0].recorded_at, reused: true };
        }
        await client.query(
          `INSERT INTO audit_events (actor_user_id,action,entity_type,entity_id,metadata)
           VALUES ($1,$2,'shipment',$3,$4::jsonb)`,
          [actorId, validation ? "shipment.proof.validated" : "shipment.receipt.approved",
            shipmentId, JSON.stringify({ proofId: row.proof_id })],
        );
        // Recording either decision never completes the transaction or initiates payout.
        return { recordedAt: result.rows[0].recorded_at, reused: false };
      });
    },
  });
}
