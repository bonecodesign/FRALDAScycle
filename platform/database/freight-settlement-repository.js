import { freightAllocation } from "../packages/contracts/freight-settlement.js";

const fail = (code, status, message) => Object.assign(new Error(message), { code, status });

export function createFreightSettlementRepository(database) {
  return Object.freeze({
    async prepare({ actorId, quoteId }) {
      return database.transaction(async client => {
        const row = (await client.query(`SELECT
          q.id, q.transaction_id, q.shipment_id, q.provider, q.status,
          q.confirmed_by, q.expires_at, q.currency, q.base_freight_cents,
          q.platform_fee_cents, q.customer_total_cents,
          t.buyer_id, l.kind, s.logistics_payer_id
          FROM delivery_quotes q
          JOIN transactions t ON t.id=q.transaction_id
          JOIN listings l ON l.id=t.listing_id
          LEFT JOIN shipments s ON s.id=q.shipment_id
          WHERE q.id=$1 FOR UPDATE OF q,t`, [quoteId])).rows[0];
        if (!row) throw fail("freight_quote_not_found", 404, "Cotação não encontrada.");
        const existing = (await client.query(
          "SELECT * FROM freight_settlement_plans WHERE delivery_quote_id=$1", [quoteId],
        )).rows[0];
        if (existing) return { plan: existing, reused: true };
        const payerId = row.shipment_id ? row.logistics_payer_id : row.buyer_id;
        if (!["sale", "exchange"].includes(row.kind)
          || (row.kind === "sale" && row.shipment_id)
          || (row.kind === "exchange" && !row.shipment_id)
          || !payerId || row.confirmed_by !== payerId
          || !["confirmed", "locked"].includes(row.status)
          || (row.status === "confirmed" && new Date(row.expires_at).getTime() <= Date.now())) {
          throw fail("freight_quote_not_confirmed", 409, "A cotação não está apta para preparação financeira.");
        }
        let allocation;
        try {
          allocation = freightAllocation({
            provider: row.provider, baseFreightCents: row.base_freight_cents,
            platformFeeCents: row.platform_fee_cents,
            customerTotalCents: row.customer_total_cents,
            currency: row.currency,
          });
        } catch {
          throw fail("freight_quote_amount_mismatch", 409, "Valores da cotação não conferem.");
        }
        const plan = (await client.query(`INSERT INTO freight_settlement_plans
          (delivery_quote_id,transaction_id,shipment_id,payer_id,provider,
           provider_amount_cents,platform_fee_cents,customer_total_cents,prepared_by)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [
          row.id, row.transaction_id, row.shipment_id, payerId, row.provider,
          allocation.providerAmountCents, allocation.platformFeeCents,
          allocation.customerTotalCents, actorId,
        ])).rows[0];
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'freight.settlement.plan.prepared','freight_settlement_plan',$2,$3::jsonb)`,
        [actorId,plan.id,JSON.stringify({deliveryQuoteId:row.id,provider:row.provider,execution:false})]);
        return { plan, reused: false };
      });
    },

    async context(planId) {
      const row = (await database.query(`SELECT
        p.*,q.id AS current_quote_id,q.status AS quote_status,q.confirmed_by AS quote_confirmed_by,
        q.provider AS quote_provider,q.base_freight_cents AS quote_base_freight_cents,
        q.platform_fee_cents AS quote_platform_fee_cents,q.customer_total_cents AS quote_total_cents,
        t.id AS current_transaction_id,t.amount_cents AS product_amount_cents,l.kind,
        pi.id AS payment_id,pi.status AS payment_status,pi.provider_reference AS payment_provider_reference,
        pi.amount_cents AS payment_amount_cents,pi.platform_fee_cents AS payment_platform_fee_cents,
        pi.delivery_fee_cents AS payment_delivery_fee_cents,pi.seller_amount_cents AS payment_seller_amount_cents,
        (SELECT count(*)::integer FROM payment_intents paid
          WHERE paid.transaction_id=t.id AND paid.status='paid') AS paid_count,
        EXISTS(SELECT 1 FROM payment_cases pc JOIN payment_intents payment
          ON payment.id=pc.payment_intent_id WHERE payment.transaction_id=t.id
          AND pc.status<>'rejected') OR EXISTS(
          SELECT 1 FROM support_tickets st WHERE st.transaction_id=t.id
          AND st.status<>'resolved' AND st.category IN('cancellation','receipt_problem')
        ) AS financial_case_pending
        FROM freight_settlement_plans p
        JOIN delivery_quotes q ON q.id=p.delivery_quote_id
        JOIN transactions t ON t.id=p.transaction_id
        JOIN listings l ON l.id=t.listing_id
        LEFT JOIN LATERAL (
          SELECT id,status,provider_reference,amount_cents,platform_fee_cents,
                 delivery_fee_cents,seller_amount_cents
          FROM payment_intents
          WHERE transaction_id=t.id ORDER BY (status='paid') DESC,created_at DESC,id DESC LIMIT 1
        ) pi ON true
        WHERE p.id=$1`, [planId])).rows[0];
      return row ?? null;
    },
  });
}
