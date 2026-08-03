export function createPaymentRepository(database) {
  return Object.freeze({
    async context({ buyerId, transactionId, idempotencyKey }) {
      return database.transaction(async (client) => {
        const existing = await client.query(
          `SELECT id, transaction_id, method, amount_cents, platform_fee_cents,
                  delivery_fee_cents, seller_amount_cents, provider_reference, status, checkout_payload
           FROM payment_intents WHERE idempotency_key = $1`,
          [idempotencyKey],
        );
        if (existing.rows[0]) return { existing: true, intent: existing.rows[0] };
        const transaction = await client.query(
          `SELECT t.id, t.buyer_id, t.seller_id, t.status, t.amount_cents, l.kind
           FROM transactions t JOIN listings l ON l.id = t.listing_id
           WHERE t.id = $1 AND t.buyer_id = $2 FOR UPDATE OF t`,
          [transactionId, buyerId],
        );
        return { existing: false, transaction: transaction.rows[0] ?? null };
      });
    },

    async createIntent(input) {
      return database.transaction(async (client) => {
        const created = await client.query(
          `INSERT INTO payment_intents
             (transaction_id, buyer_id, idempotency_key, method, amount_cents,
              platform_fee_cents, delivery_fee_cents, seller_amount_cents)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
           RETURNING *`,
          [input.transactionId, input.buyerId, input.idempotencyKey, input.method,
           input.amountCents, input.platformFeeCents, input.deliveryFeeCents, input.sellerAmountCents],
        );
        await client.query(
          `UPDATE transactions SET status = 'payment_pending', updated_at = now()
           WHERE id = $1 AND status IN ('proposed', 'reserved', 'payment_pending')`,
          [input.transactionId],
        );
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'payment.intent.created', 'payment_intent', $2, $3::jsonb)`,
          [input.buyerId, created.rows[0].id, JSON.stringify({
            transactionId: input.transactionId, method: input.method,
            platformFeeCents: input.platformFeeCents, deliveryFeeCents: input.deliveryFeeCents,
          })],
        );
        return created.rows[0];
      });
    },

    async attachProvider({ intentId, providerReference, status, checkoutPayload }) {
      const result = await database.query(
        `UPDATE payment_intents
         SET provider_reference = $2, status = $3::payment_intent_status,
             checkout_payload = $4::jsonb, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [intentId, providerReference, status, JSON.stringify(checkoutPayload ?? {})],
      );
      return result.rows[0];
    },

    async processWebhook(event) {
      return database.transaction(async (client) => {
        const inserted = await client.query(
          `INSERT INTO payment_webhook_events
             (id, event_type, provider_reference, occurred_at, payload_hash)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING RETURNING id`,
          [event.id, event.type, event.providerReference, event.occurredAt, event.payloadHash],
        );
        if (!inserted.rows[0]) return { duplicate: true };
        const found = await client.query(
          `SELECT p.id, p.transaction_id, p.amount_cents, p.status
           FROM payment_intents p WHERE p.provider_reference = $1 FOR UPDATE`,
          [event.providerReference],
        );
        const intent = found.rows[0];
        if (!intent) return { missing: true };
        if (intent.amount_cents !== event.amountCents) return { amountMismatch: true };

        const intentStatus = {
          "payment.authorized": "authorized", "payment.paid": "paid",
          "payment.failed": "failed", "payment.refunded": "refunded",
          "payment.disputed": "disputed",
        }[event.type];
        const transactionStatus = {
          "payment.authorized": "payment_pending", "payment.paid": "paid",
          "payment.failed": "payment_pending", "payment.refunded": "refunded",
          "payment.disputed": "disputed",
        }[event.type];
        await client.query(
          `UPDATE payment_intents SET status = $2::payment_intent_status, updated_at = now()
           WHERE id = $1`,
          [intent.id, intentStatus],
        );
        await client.query(
          `UPDATE transactions SET status = $2::transaction_status, updated_at = now()
           WHERE id = $1`,
          [intent.transaction_id, transactionStatus],
        );
        await client.query(
          `INSERT INTO audit_events (action, entity_type, entity_id, metadata)
           VALUES ('payment.webhook.processed', 'payment_intent', $1, $2::jsonb)`,
          [intent.id, JSON.stringify({ eventId: event.id, eventType: event.type })],
        );
        return { duplicate: false, status: intentStatus };
      });
    },

    async markProviderFailure({ intentId, failureCode }) {
      await database.query(
        `UPDATE payment_intents SET status = 'failed', failure_code = $2, updated_at = now()
         WHERE id = $1 AND status = 'provider_pending'`,
        [intentId, failureCode],
      );
    },
  });
}
