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

    async recordIncidents({ actorId, planId, codes }) {
      return database.transaction(async client => {
        const locked = (await client.query(
          'SELECT id FROM freight_settlement_plans WHERE id=$1 FOR UPDATE', [planId],
        )).rows[0];
        if (!locked) throw fail('freight_plan_not_found',404,'Preparação financeira não encontrada.');
        for (const code of codes) {
          await client.query(`INSERT INTO freight_reconciliation_incidents
            (freight_settlement_plan_id,code,detected_by)
            VALUES($1,$2,$3)
            ON CONFLICT (freight_settlement_plan_id,code) WHERE status='open'
            DO UPDATE SET last_detected_at=now()`,[planId,code,actorId]);
        }
        await client.query(`UPDATE freight_reconciliation_incidents
          SET status='resolved',resolved_at=now(),resolved_by=$2
          WHERE freight_settlement_plan_id=$1 AND status='open'
            AND NOT (code=ANY($3::text[]))`,[planId,actorId,codes]);
        const incidents=(await client.query(`SELECT id,code,status,first_detected_at,last_detected_at,resolved_at
          FROM freight_reconciliation_incidents WHERE freight_settlement_plan_id=$1
          ORDER BY first_detected_at DESC,id DESC`,[planId])).rows;
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'freight.reconciliation.local.checked','freight_settlement_plan',$2,$3::jsonb)`,
          [actorId,planId,JSON.stringify({localCodes:codes,openCount:incidents.filter(i=>i.status==='open').length,providerReconciled:false})]);
        return incidents;
      });
    },

    async supervision(planId) {
      const row=(await database.query(`SELECT s.freight_settlement_plan_id AS plan_id,
        i.id AS incident_id,i.reference,i.domain,i.severity,i.status,i.assigned_to,i.version,
        s.linked_at
        FROM freight_incident_supervision s
        JOIN operational_incidents i ON i.id=s.operational_incident_id
        WHERE s.freight_settlement_plan_id=$1`,[planId])).rows[0];
      return row??null;
    },

    async linkSupervision({actorId,planId,incidentId}) {
      return database.transaction(async client=>{
        const plan=(await client.query(`SELECT id FROM freight_settlement_plans
          WHERE id=$1 FOR UPDATE`,[planId])).rows[0];
        if(!plan)throw fail("freight_plan_not_found",404,"Preparação financeira não encontrada.");
        const existing=(await client.query(`SELECT operational_incident_id
          FROM freight_incident_supervision WHERE freight_settlement_plan_id=$1`,[planId])).rows[0];
        if(existing) {
          if(existing.operational_incident_id!==incidentId)
            throw fail("freight_supervision_already_linked",409,"Este plano já possui incidente vinculado.");
          return {planId,incidentId,reused:true};
        }
        const active=(await client.query(`SELECT 1 FROM freight_reconciliation_incidents
          WHERE freight_settlement_plan_id=$1 AND status='open' LIMIT 1`,[planId])).rows[0];
        if(!active)throw fail("freight_supervision_no_open_discrepancy",409,
          "É necessário registrar uma divergência local aberta antes do encaminhamento.");
        const incident=(await client.query(`SELECT id,domain,status FROM operational_incidents
          WHERE id=$1 FOR UPDATE`,[incidentId])).rows[0];
        if(!incident||!['payments','payouts'].includes(incident.domain)||incident.status==='resolved')
          throw fail("freight_supervision_incident_ineligible",409,
            "Selecione um incidente financeiro operacional ativo.");
        const occupied=(await client.query(`SELECT freight_settlement_plan_id
          FROM freight_incident_supervision WHERE operational_incident_id=$1`,[incidentId])).rows[0];
        if(occupied)throw fail("freight_supervision_incident_already_linked",409,
          "Este incidente já está associado a outro plano.");
        await client.query(`INSERT INTO freight_incident_supervision
          (freight_settlement_plan_id,operational_incident_id,linked_by)
          VALUES($1,$2,$3)`,[planId,incidentId,actorId]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'freight.reconciliation.supervision.linked','freight_settlement_plan',$2,$3::jsonb)`,
          [actorId,planId,JSON.stringify({operationalIncidentId:incidentId,execution:false})]);
        return {planId,incidentId,reused:false};
      });
    },

    async exchangeDifferenceContext(transactionId) {
      const row=(await database.query(`SELECT e.transaction_id,e.status,e.requester_id,e.owner_id,
        e.requested_listing_id,e.offered_listing_id,
        e.requester_declared_value_cents,e.owner_declared_value_cents,
        COALESCE((SELECT json_agg(json_build_object(
          'transaction_id',f.transaction_id,'participant_id',f.participant_id,
          'offered_listing_id',f.offered_listing_id,
          'declared_value_cents',f.declared_value_cents,
          'fee_basis_points',f.fee_basis_points,'fee_cents',f.fee_cents,
          'status',f.status) ORDER BY f.participant_id)
          FROM exchange_fee_obligations f WHERE f.transaction_id=e.transaction_id),'[]'::json) AS fee_rows,
        (SELECT json_build_object('transaction_id',d.transaction_id,
          'payer_id',d.payer_id,'recipient_id',d.recipient_id,
          'lower_value_cents',d.lower_value_cents,'higher_value_cents',d.higher_value_cents,
          'amount_cents',d.amount_cents,'status',d.status)
          FROM exchange_difference_obligations d WHERE d.transaction_id=e.transaction_id) AS difference_row
        FROM exchange_operations e WHERE e.transaction_id=$1`,[transactionId])).rows[0];
      return row??null;
    },

    async exchangeLegs(transactionId) {
      const rows = (await database.query(`SELECT
        t.id AS transaction_id,t.buyer_id AS transaction_buyer_id,
        t.seller_id AS transaction_seller_id,
        s.id AS shipment_id,s.transaction_id AS shipment_transaction_id,
        s.exchange_leg,s.buyer_id AS shipment_recipient_id,
        s.seller_id AS shipment_sender_id,s.logistics_payer_id AS shipment_payer_id,
        q.id AS quote_id,q.shipment_id AS quote_shipment_id,
        q.transaction_id AS quote_transaction_id,q.status AS quote_status,
        q.confirmed_by AS quote_confirmed_by,q.provider AS quote_provider,
        q.currency AS quote_currency,q.expires_at AS quote_expires_at,
        q.base_freight_cents AS quote_base_cents,
        q.platform_fee_cents AS quote_platform_fee_cents,
        q.customer_total_cents AS quote_total_cents,
        p.id AS plan_id,p.delivery_quote_id AS plan_quote_id,
        p.transaction_id AS plan_transaction_id,p.shipment_id AS plan_shipment_id,
        p.payer_id AS plan_payer_id,p.provider AS plan_provider,
        p.provider_amount_cents AS plan_provider_amount_cents,
        p.platform_fee_cents AS plan_platform_fee_cents,
        p.customer_total_cents AS plan_total_cents
        FROM transactions t
        JOIN listings l ON l.id=t.listing_id AND l.kind='exchange'
        LEFT JOIN shipments s ON s.transaction_id=t.id AND s.exchange_leg IN(1,2)
        LEFT JOIN LATERAL (
          SELECT * FROM delivery_quotes candidate
          WHERE candidate.transaction_id=t.id AND candidate.shipment_id=s.id
            AND candidate.status IN ('quoted','confirmed','locked')
          ORDER BY candidate.created_at DESC,candidate.id DESC LIMIT 1
        ) q ON true
        LEFT JOIN freight_settlement_plans p ON p.delivery_quote_id=q.id
        WHERE t.id=$1 ORDER BY s.exchange_leg NULLS LAST,s.id`,[transactionId])).rows;
      return rows.length ? {
        buyerId: rows[0].transaction_buyer_id,
        sellerId: rows[0].transaction_seller_id,
        rows,
      } : null;
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
