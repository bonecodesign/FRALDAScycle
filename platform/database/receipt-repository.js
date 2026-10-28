import {verifiedInstitutionRepresentative} from './institution-access-repository.js';
function failure(code, status, message) {
  return Object.assign(new Error(message), { code, status });
}

export function createReceiptRepository(database) {
  return Object.freeze({
    async sellerPayoutStatus({actorId,shipmentId,reviewer=false}){return database.transaction(async client=>{
      const row=(await client.query(`SELECT s.id AS shipment_id,s.transaction_id,s.seller_id,s.status AS shipment_status,t.status AS transaction_status,l.kind,
        p.id AS proof_id,a.approved_at,v.validated_at,pi.id AS payment_intent_id,pi.status AS payment_status,pi.amount_cents,pi.platform_fee_cents,pi.delivery_fee_cents,pi.seller_amount_cents,pi.provider_reference AS payment_provider_reference,
        (SELECT count(*)::integer FROM payment_intents paid WHERE paid.transaction_id=t.id AND paid.status='paid') AS paid_count,
        EXISTS(SELECT 1 FROM payment_cases pc WHERE pc.payment_intent_id=pi.id AND pc.status<>'rejected') OR EXISTS(SELECT 1 FROM support_tickets st WHERE st.transaction_id=t.id AND st.status<>'resolved' AND st.category IN('cancellation','receipt_problem')) AS financial_case_pending,
        spo.id AS obligation_id,spo.status AS payout_status,spo.prepared_at
        FROM shipments s JOIN transactions t ON t.id=s.transaction_id JOIN listings l ON l.id=t.listing_id
        LEFT JOIN delivery_proofs p ON p.shipment_id=s.id LEFT JOIN delivery_receipt_approvals a ON a.proof_id=p.id LEFT JOIN delivery_proof_validations v ON v.proof_id=p.id
        LEFT JOIN payment_intents pi ON pi.transaction_id=t.id AND pi.status='paid' LEFT JOIN seller_payout_obligations spo ON spo.shipment_id=s.id
        WHERE s.id=$1 AND ($3::boolean OR s.seller_id=$2)`,[shipmentId,actorId,reviewer])).rows[0];
      if(!row)return null;await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'seller.payout.status.read','shipment',$2,$3::jsonb)`,[actorId,shipmentId,JSON.stringify({reviewer,status:row.payout_status??'not_prepared'})]);return row;
    });},
    async prepareSellerPayout({actorId,shipmentId}){return database.transaction(async client=>{
      const row=(await client.query(`SELECT s.id AS shipment_id,s.transaction_id,s.seller_id,s.status AS shipment_status,t.status AS transaction_status,l.kind,
        p.id AS proof_id,a.approved_at,v.validated_at,pi.id AS payment_intent_id,pi.status AS payment_status,pi.amount_cents,pi.platform_fee_cents,pi.delivery_fee_cents,pi.seller_amount_cents,pi.provider_reference AS payment_provider_reference,
        (SELECT count(*)::integer FROM payment_intents paid WHERE paid.transaction_id=t.id AND paid.status='paid') AS paid_count,
        EXISTS(SELECT 1 FROM payment_cases pc WHERE pc.payment_intent_id=pi.id AND pc.status<>'rejected') OR EXISTS(SELECT 1 FROM support_tickets st WHERE st.transaction_id=t.id AND st.status<>'resolved' AND st.category IN('cancellation','receipt_problem')) AS financial_case_pending
        FROM shipments s JOIN transactions t ON t.id=s.transaction_id JOIN listings l ON l.id=t.listing_id
        LEFT JOIN delivery_proofs p ON p.shipment_id=s.id LEFT JOIN delivery_receipt_approvals a ON a.proof_id=p.id LEFT JOIN delivery_proof_validations v ON v.proof_id=p.id
        LEFT JOIN payment_intents pi ON pi.transaction_id=t.id AND pi.status='paid' WHERE s.id=$1 FOR UPDATE OF s,t`,[shipmentId])).rows[0];
      if(!row)throw failure('shipment_not_found',404,'Entrega não encontrada.');const blockers=[];
      if(row.kind!=='sale')blockers.push('unsupported_transaction_kind');if(row.shipment_status!=='delivered'||!row.proof_id)blockers.push('delivery_proof_pending');if(row.transaction_status!=='in_delivery')blockers.push('transaction_not_eligible');
      if(row.paid_count!==1||row.payment_status!=='paid'||!row.payment_provider_reference)blockers.push('payment_not_confirmed');if(row.financial_case_pending!==false)blockers.push('financial_case_pending');if(!row.approved_at)blockers.push('receiver_approval_pending');if(!row.validated_at)blockers.push('proof_validation_pending');
      if(!Number.isSafeInteger(row.amount_cents)||row.amount_cents<=0||row.delivery_fee_cents!==0||row.platform_fee_cents+row.seller_amount_cents!==row.amount_cents)blockers.push('payment_split_invalid');
      if(blockers.length)throw Object.assign(new Error('O repasse ao vendedor ainda possui pendências.'),{code:'seller_payout_not_eligible',status:409,blockers});
      const existing=(await client.query('SELECT * FROM seller_payout_obligations WHERE shipment_id=$1',[shipmentId])).rows[0];if(existing)return {...existing,reused:true};
      const snapshot={shipmentStatus:row.shipment_status,transactionStatus:row.transaction_status,paymentStatus:row.payment_status,receiverApprovedAt:row.approved_at,proofValidatedAt:row.validated_at};
      const created=(await client.query(`INSERT INTO seller_payout_obligations(shipment_id,transaction_id,payment_intent_id,seller_id,gross_product_cents,platform_fee_cents,seller_amount_cents,eligibility_snapshot,prepared_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING *`,[shipmentId,row.transaction_id,row.payment_intent_id,row.seller_id,row.amount_cents,row.platform_fee_cents,row.seller_amount_cents,JSON.stringify(snapshot),actorId])).rows[0];
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'seller.payout.prepared','shipment',$2,$3::jsonb)`,[actorId,shipmentId,JSON.stringify({obligationId:created.id,grossProductCents:row.amount_cents,platformFeeCents:row.platform_fee_cents,sellerAmountCents:row.seller_amount_cents,status:'provider_pending'})]);return {...created,reused:false};
    });},
    async courierPayoutStatus({actorId,shipmentId,reviewer=false}){
      return database.transaction(async client=>{
        const result=await client.query(`SELECT s.id AS shipment_id,s.transaction_id,s.courier_id,s.status AS shipment_status,
          t.status AS transaction_status,l.kind,p.id AS proof_id,a.approved_at,v.validated_at,
          pi.id AS payment_intent_id,pi.status AS payment_status,pi.delivery_fee_cents,pi.provider_reference AS payment_provider_reference,
          (SELECT count(*)::integer FROM payment_intents paid WHERE paid.transaction_id=t.id AND paid.status='paid') AS paid_count,
          EXISTS(SELECT 1 FROM payment_cases pc WHERE pc.payment_intent_id=pi.id AND pc.status<>'rejected') OR
          EXISTS(SELECT 1 FROM support_tickets st WHERE st.transaction_id=t.id AND st.status<>'resolved' AND st.category IN('cancellation','receipt_problem')) AS financial_case_pending,
          cpo.id AS obligation_id,cpo.platform_fee_cents,cpo.courier_amount_cents,cpo.status AS payout_status,cpo.prepared_at
          FROM shipments s JOIN transactions t ON t.id=s.transaction_id JOIN listings l ON l.id=t.listing_id
          LEFT JOIN delivery_proofs p ON p.shipment_id=s.id LEFT JOIN delivery_receipt_approvals a ON a.proof_id=p.id
          LEFT JOIN delivery_proof_validations v ON v.proof_id=p.id
          LEFT JOIN payment_intents pi ON pi.transaction_id=t.id AND pi.status='paid'
          LEFT JOIN courier_payout_obligations cpo ON cpo.shipment_id=s.id
          WHERE s.id=$1 AND ($3::boolean OR s.courier_id=$2)`,[shipmentId,actorId,reviewer]);
        const row=result.rows[0];if(!row)return null;
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'courier.payout.status.read','shipment',$2,$3::jsonb)`,[actorId,shipmentId,JSON.stringify({reviewer,status:row.payout_status??'not_prepared'})]);
        return row;
      });
    },
    async prepareCourierPayout({actorId,shipmentId}){
      return database.transaction(async client=>{
        const found=await client.query(`SELECT s.id AS shipment_id,s.transaction_id,s.courier_id,s.status AS shipment_status,
          t.status AS transaction_status,l.kind,p.id AS proof_id,a.approved_at,v.validated_at,
          pi.id AS payment_intent_id,pi.status AS payment_status,pi.delivery_fee_cents,pi.provider_reference AS payment_provider_reference,
          (SELECT count(*)::integer FROM payment_intents paid WHERE paid.transaction_id=t.id AND paid.status='paid') AS paid_count,
          EXISTS(SELECT 1 FROM payment_cases pc WHERE pc.payment_intent_id=pi.id AND pc.status<>'rejected') OR
          EXISTS(SELECT 1 FROM support_tickets st WHERE st.transaction_id=t.id AND st.status<>'resolved' AND st.category IN('cancellation','receipt_problem')) AS financial_case_pending
          FROM shipments s JOIN transactions t ON t.id=s.transaction_id JOIN listings l ON l.id=t.listing_id
          LEFT JOIN delivery_proofs p ON p.shipment_id=s.id LEFT JOIN delivery_receipt_approvals a ON a.proof_id=p.id
          LEFT JOIN delivery_proof_validations v ON v.proof_id=p.id
          LEFT JOIN payment_intents pi ON pi.transaction_id=t.id AND pi.status='paid'
          WHERE s.id=$1 FOR UPDATE OF s,t`,[shipmentId]);
        const row=found.rows[0];if(!row)throw failure('shipment_not_found',404,'Entrega não encontrada.');
        const blockers=[];
        if(row.kind!=='sale')blockers.push('unsupported_transaction_kind');
        if(row.shipment_status!=='delivered'||!row.proof_id)blockers.push('delivery_proof_pending');
        if(row.transaction_status!=='in_delivery')blockers.push('transaction_not_eligible');
        if(row.paid_count!==1||row.payment_status!=='paid'||!row.payment_provider_reference)blockers.push('payment_not_confirmed');
        if(!Number.isSafeInteger(row.delivery_fee_cents)||row.delivery_fee_cents<=0)blockers.push('freight_not_charged');
        if(row.financial_case_pending!==false)blockers.push('financial_case_pending');
        if(!row.approved_at)blockers.push('receiver_approval_pending');if(!row.validated_at)blockers.push('proof_validation_pending');
        if(!row.courier_id)blockers.push('courier_not_assigned');
        if(blockers.length)throw Object.assign(new Error('O repasse ao entregador ainda possui pendências.'),{code:'courier_payout_not_eligible',status:409,blockers});
        const existing=(await client.query('SELECT * FROM courier_payout_obligations WHERE shipment_id=$1',[shipmentId])).rows[0];
        if(existing)return {...existing,reused:true};
        const platformFee=Math.floor((row.delivery_fee_cents*500+5000)/10000),courierAmount=row.delivery_fee_cents-platformFee;
        const snapshot={shipmentStatus:row.shipment_status,transactionStatus:row.transaction_status,paymentStatus:row.payment_status,receiverApprovedAt:row.approved_at,proofValidatedAt:row.validated_at};
        const created=(await client.query(`INSERT INTO courier_payout_obligations
          (shipment_id,transaction_id,payment_intent_id,courier_id,freight_cents,platform_fee_cents,courier_amount_cents,eligibility_snapshot,prepared_by)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING *`,[shipmentId,row.transaction_id,row.payment_intent_id,row.courier_id,row.delivery_fee_cents,platformFee,courierAmount,JSON.stringify(snapshot),actorId])).rows[0];
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'courier.payout.prepared','shipment',$2,$3::jsonb)`,[actorId,shipmentId,JSON.stringify({obligationId:created.id,freightCents:row.delivery_fee_cents,platformFeeCents:platformFee,courierAmountCents:courierAmount,status:'provider_pending'})]);
        return {...created,reused:false};
      });
    },
    async receiptEvidence({ userId, shipmentId, reviewer = false }) {
      return database.transaction(async (client) => {
        const result = await client.query(
          `SELECT p.id, p.media_key, p.courier_id, p.created_at,
                  a.approved_at, v.validated_at, s.status AS shipment_status,
                  t.status AS transaction_status, l.kind,
                  COALESCE(d.version=2 AND d.representative_id=s.buyer_id AND ir.user_id=s.buyer_id AND ir.status='verified' AND i.status='active' AND ru.email_verified_at IS NOT NULL AND lower(ru.email)=lower(i.representative_email),false) AS donation_authorized,d.institution_id AS donation_institution_id,d.version AS donation_version,
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
           JOIN listings l ON l.id=t.listing_id LEFT JOIN donation_operations d ON d.transaction_id=t.id LEFT JOIN institutions i ON i.id=d.institution_id LEFT JOIN institution_representatives ir ON ir.institution_id=i.id LEFT JOIN users ru ON ru.id=ir.user_id
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
                  t.status AS transaction_status, l.kind,
                  COALESCE(d.version=2 AND d.representative_id=s.buyer_id AND ir.user_id=s.buyer_id AND ir.status='verified' AND i.status='active' AND ru.email_verified_at IS NOT NULL AND lower(ru.email)=lower(i.representative_email),false) AS donation_authorized,d.institution_id AS donation_institution_id,d.version AS donation_version, p.id AS proof_id
           FROM shipments s JOIN transactions t ON t.id=s.transaction_id
           JOIN listings l ON l.id=t.listing_id LEFT JOIN donation_operations d ON d.transaction_id=t.id LEFT JOIN institutions i ON i.id=d.institution_id LEFT JOIN institution_representatives ir ON ir.institution_id=i.id LEFT JOIN users ru ON ru.id=ir.user_id
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
        if (!["sale","donation","exchange"].includes(row.kind)) {
          throw failure("receipt_flow_not_configured", 503, "A confirmação de troca ainda não está disponível.");
        }
        if(row.kind==='donation'){await client.query('SELECT id FROM institutions WHERE id=$1 FOR SHARE',[row.donation_institution_id]);row.donation_authorized=row.donation_version===2&&await verifiedInstitutionRepresentative(client,row.donation_institution_id)===row.buyer_id;}
        if(row.kind==='donation'&&row.donation_authorized!==true)throw failure("institution_receipt_authority_pending",409,"Aguarde a análise da autoridade institucional pelo suporte.");
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

