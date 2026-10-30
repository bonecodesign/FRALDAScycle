export function createPaymentRepository(database,{stepUpRepository=null}={}) {
  return Object.freeze({
    async billingIdentity(userId) {
      const result = await database.query(`SELECT cpf_fingerprint FROM users
        WHERE id=$1 AND disabled_at IS NULL AND responsible_registration_completed_at IS NOT NULL`, [userId]);
      return result.rows[0] ?? null;
    },

    async supportedRefundStatus(cancellationId) {
      const result=await database.query(`SELECT c.id,c.transaction_id,c.support_ticket_id,c.cancellation_phase,
        c.gross_amount_cents,c.retained_platform_fee_cents,c.retained_delivery_fee_cents,c.refund_amount_cents,
        c.reason,c.status,c.provider_case_reference,c.execution_failure_code,c.submitted_at,c.completed_at,c.created_at,c.updated_at
        FROM supported_cancellations c WHERE c.id=$1`,[cancellationId]);
      return result.rows[0]??null;
    },

    async supportedRefundQueue(limit=50){const result=await database.query(`SELECT c.id,c.support_ticket_id,c.refund_amount_cents,c.status,
      c.submitted_at,c.completed_at,c.execution_failure_code,a.id AS alert_id,a.created_at AS alert_created_at
      FROM supported_cancellations c LEFT JOIN supported_refund_alerts a ON a.supported_cancellation_id=c.id AND a.resolved_at IS NULL
      WHERE c.status IN ('provider_pending','submitted','failed') OR (c.status='completed' AND c.completed_at>now()-interval '7 days')
      ORDER BY (a.id IS NOT NULL) DESC,c.updated_at DESC LIMIT $1`,[limit]);return result.rows;},

    async supportedRefundHistory(cancellationId){const [checks,reviews]=await Promise.all([
      database.query(`SELECT observed_status,observed_amount_cents,matched,failure_code,checked_at
        FROM supported_refund_reconciliation_checks WHERE supported_cancellation_id=$1 ORDER BY checked_at DESC LIMIT 50`,[cancellationId]),
      database.query(`SELECT r.id,r.action,r.note,r.created_at,u.full_name AS actor_name FROM supported_refund_reviews r
        JOIN users u ON u.id=r.actor_user_id WHERE r.supported_cancellation_id=$1 ORDER BY r.created_at DESC LIMIT 50`,[cancellationId]),
    ]);return{checks:checks.rows,reviews:reviews.rows};},

    addSupportedRefundReview({actorId,cancellationId,action,note}){return database.transaction(async client=>{
      const refund=(await client.query(`SELECT id,status FROM supported_cancellations WHERE id=$1 FOR UPDATE`,[cancellationId])).rows[0];
      if(!refund)throw Object.assign(new Error('Decisão de reembolso não encontrada.'),{code:'supported_refund_not_found',status:404});
      if(refund.status!=='failed')throw Object.assign(new Error('Somente casos bloqueados podem receber encaminhamento manual.'),{code:'supported_refund_review_not_allowed',status:409});
      const review=(await client.query(`INSERT INTO supported_refund_reviews(supported_cancellation_id,actor_user_id,action,note)
        VALUES($1,$2,$3,$4) RETURNING id,action,note,created_at`,[cancellationId,actorId,action,note])).rows[0];
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'refund.blocked.reviewed','supported_cancellation',$2,$3::jsonb)`,[actorId,cancellationId,JSON.stringify({reviewAction:action})]);
      return review;
    });},

    flagOverdueSupportedRefunds({thresholdMinutes=120,limit=50}={}){return database.transaction(async client=>{
      const rows=(await client.query(`SELECT c.id FROM supported_cancellations c
        WHERE c.status='submitted' AND c.submitted_at<=now()-($1*interval '1 minute')
        AND NOT EXISTS(SELECT 1 FROM supported_refund_alerts a WHERE a.supported_cancellation_id=c.id AND a.kind='provider_confirmation_overdue' AND a.resolved_at IS NULL)
        ORDER BY c.submitted_at LIMIT $2 FOR UPDATE OF c SKIP LOCKED`,[thresholdMinutes,limit])).rows;
      let created=0;for(const row of rows){const alert=(await client.query(`INSERT INTO supported_refund_alerts(supported_cancellation_id,kind)
        VALUES($1,'provider_confirmation_overdue') ON CONFLICT DO NOTHING RETURNING id`,[row.id])).rows[0];if(alert)await client.query(`INSERT INTO audit_events(action,entity_type,entity_id,metadata)
        VALUES('refund.confirmation.overdue','supported_cancellation',$1,$2::jsonb)`,[row.id,JSON.stringify({thresholdMinutes})]);if(alert)created++;}
      return{checked:rows.length,created};
    });},

    reserveSupportedRefund({actorId,cancellationId,idempotencyKey,grantId}){return database.transaction(async client=>{
      if(!stepUpRepository)throw Object.assign(new Error('Confirmação financeira indisponível.'),{code:'refund_step_up_unavailable',status:503});
      const row=(await client.query(`SELECT c.*,p.provider_reference AS payment_provider_reference
        FROM supported_cancellations c JOIN payment_intents p ON p.id=c.payment_intent_id
        WHERE c.id=$1 FOR UPDATE OF c,p`,[cancellationId])).rows[0];
      if(!row)throw Object.assign(new Error('Decisão de reembolso não encontrada.'),{code:'supported_refund_not_found',status:404});
      if(row.execution_idempotency_key){if(row.execution_idempotency_key!==idempotencyKey)throw Object.assign(new Error('A execução já possui outra chave.'),{code:'refund_execution_conflict',status:409});return{refund:row,reused:true};}
      if(row.status!=='provider_pending'||!row.payment_provider_reference||row.refund_amount_cents<0)throw Object.assign(new Error('Reembolso não está pronto para execução.'),{code:'supported_refund_not_ready',status:409});
      const grant=await stepUpRepository.consume(client,{grantId,userId:actorId,purpose:'refund_execution'});if(!grant)throw Object.assign(new Error('Confirmação financeira inválida ou expirada.'),{code:'refund_step_up_required',status:409});
      const refund=(await client.query(`UPDATE supported_cancellations SET status='submitted',execution_idempotency_key=$2,
        executed_by=$3,submitted_at=now(),execution_failure_code=NULL,updated_at=now() WHERE id=$1 RETURNING *`,[cancellationId,idempotencyKey,actorId])).rows[0];
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'refund.execution.reserved','supported_cancellation',$2,$3::jsonb)`,[actorId,cancellationId,JSON.stringify({refundAmountCents:refund.refund_amount_cents,idempotencyKey})]);
      return{refund:{...refund,payment_provider_reference:row.payment_provider_reference},reused:false};
    });},
    finishSupportedRefund({actorId,cancellationId,providerCaseReference}){return database.transaction(async client=>{const refund=(await client.query(`UPDATE supported_cancellations SET provider_case_reference=$2,execution_failure_code=NULL,updated_at=now()
      WHERE id=$1 AND status='submitted' RETURNING *`,[cancellationId,providerCaseReference])).rows[0];if(!refund)return null;await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      VALUES($1,'refund.execution.submitted','supported_cancellation',$2,$3::jsonb)`,[actorId,cancellationId,JSON.stringify({providerCaseReference})]);return refund;});},
    failSupportedRefund({actorId,cancellationId,failureCode}){return database.transaction(async client=>{const refund=(await client.query(`UPDATE supported_cancellations SET status='failed',execution_failure_code=$2,updated_at=now()
      WHERE id=$1 AND status='submitted' RETURNING *`,[cancellationId,failureCode])).rows[0];if(refund)await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      VALUES($1,'refund.execution.failed','supported_cancellation',$2,$3::jsonb)`,[actorId,cancellationId,JSON.stringify({failureCode})]);return refund;});},

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
        const eligibility = await client.query(`SELECT id FROM transactions
          WHERE id=$1 AND buyer_id=$2 AND status IN ('initiated','payment_pending') FOR UPDATE`,
          [input.transactionId,input.buyerId]);
        if (!eligibility.rows[0]) throw Object.assign(new Error("Esta transação não pode ser paga."), {code:"transaction_not_payable",status:409});
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
           WHERE id = $1 AND status IN ('initiated', 'payment_pending')`,
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

    async caseContext({ requesterId, intentId, idempotencyKey }) {
      return database.transaction(async (client) => {
        const existing = await client.query(
          `SELECT id, payment_intent_id, kind, reason, details, provider_reference, status
           FROM payment_cases WHERE idempotency_key = $1`,
          [idempotencyKey],
        );
        if (existing.rows[0]) return { existing: true, paymentCase: existing.rows[0] };
        const intent = await client.query(
          `SELECT p.id, p.provider_reference, p.status, p.amount_cents, t.buyer_id, t.status AS transaction_status
           FROM payment_intents p JOIN transactions t ON t.id = p.transaction_id
           WHERE p.id = $1 AND t.buyer_id = $2 FOR UPDATE OF p`,
          [intentId, requesterId],
        );
        return { existing: false, intent: intent.rows[0] ?? null };
      });
    },

    async createCase(input) {
      return database.transaction(async (client) => {
        const created = await client.query(
          `INSERT INTO payment_cases
             (payment_intent_id, requester_id, kind, idempotency_key, reason, details)
           VALUES ($1,$2,$3::payment_case_kind,$4,$5,$6)
           ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
           RETURNING *`,
          [input.intentId, input.requesterId, input.kind, input.idempotencyKey, input.reason, input.details],
        );
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'payment_case', $3, $4::jsonb)`,
          [input.requesterId, `payment.${input.kind}.requested`, created.rows[0].id,
           JSON.stringify({ paymentIntentId: input.intentId, reason: input.reason })],
        );
        return created.rows[0];
      });
    },

    async attachCaseProvider({ caseId, providerReference, status }) {
      const result = await database.query(
        `UPDATE payment_cases SET provider_reference = $2, status = $3::payment_case_status, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [caseId, providerReference, status],
      );
      return result.rows[0];
    },

    async markCaseFailure({ caseId, failureCode }) {
      await database.query(
        `UPDATE payment_cases SET status = 'failed', failure_code = $2, updated_at = now()
         WHERE id = $1 AND status = 'provider_pending'`,
        [caseId, failureCode],
      );
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
        const supportedRefund=event.type==='payment.refunded'?(await client.query(`SELECT id,refund_amount_cents,status FROM supported_cancellations
          WHERE payment_intent_id=$1 AND status='submitted' FOR UPDATE`,[intent.id])).rows[0]:null;
        const expectedAmount=supportedRefund?.refund_amount_cents??intent.amount_cents;
        if (expectedAmount !== event.amountCents) return { amountMismatch: true };

        const intentStatus = {
          "payment.authorized": "authorized", "payment.paid": "paid",
          "payment.failed": "failed", "payment.refunded": "refunded",
          "payment.disputed": "disputed",
        }[event.type];
        if ((intent.status === "refunded" && intentStatus !== "refunded") ||
            (intent.status === "disputed" && !["disputed", "refunded"].includes(intentStatus)) ||
            (intent.status === "paid" && ["authorized", "failed"].includes(intentStatus))) {
          return { ignored: true, status: intent.status };
        }
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
           WHERE id = $1 AND (
             ($2 IN ('refunded','disputed') AND status <> 'refunded') OR
             ($2 IN ('paid','payment_pending') AND status IN ('initiated','payment_pending','paid'))
           )`,
          [intent.transaction_id, transactionStatus],
        );
        if(supportedRefund){
          await client.query(`UPDATE supported_cancellations SET status='completed',completed_at=$2,completion_source='webhook',
            completion_webhook_event_id=$3,execution_failure_code=NULL,updated_at=now() WHERE id=$1 AND status='submitted'`,
          [supportedRefund.id,event.occurredAt,event.id]);
          await client.query(`INSERT INTO audit_events(action,entity_type,entity_id,metadata)
            VALUES('refund.execution.completed','supported_cancellation',$1,$2::jsonb)`,
          [supportedRefund.id,JSON.stringify({eventId:event.id,refundAmountCents:event.amountCents})]);
          await client.query(`UPDATE supported_refund_alerts SET resolved_at=now(),resolution='Confirmação recebida por webhook financeiro.'
            WHERE supported_cancellation_id=$1 AND resolved_at IS NULL`,[supportedRefund.id]);
        }
        if (event.type === "payment.paid") {
          await client.query(
            `INSERT INTO transaction_contact_access(transaction_id,payment_intent_id)
             SELECT t.id,$2 FROM transactions t JOIN listings l ON l.id=t.listing_id
             WHERE t.id=$1 AND l.kind='sale'
             ON CONFLICT (transaction_id) DO UPDATE SET
               payment_intent_id=EXCLUDED.payment_intent_id,unlocked_at=now(),
               revoked_at=NULL,revoked_by=NULL,revocation_reason=NULL`,
            [intent.transaction_id,intent.id],
          );
        }
        await client.query(
          `INSERT INTO audit_events (action, entity_type, entity_id, metadata)
           VALUES ('payment.webhook.processed', 'payment_intent', $1, $2::jsonb)`,
          [intent.id, JSON.stringify({ eventId: event.id, eventType: event.type })],
        );
        return { duplicate: false, status: intentStatus, supportedRefundCompleted:Boolean(supportedRefund) };
      });
    },

    async markProviderFailure({ intentId, failureCode }) {
      await database.query(
        `UPDATE payment_intents SET status = 'failed', failure_code = $2, updated_at = now()
         WHERE id = $1 AND status = 'provider_pending'`,
        [intentId, failureCode],
      );
    },

    async pendingSupportedRefunds(limit=20){const result=await database.query(`SELECT id,provider_case_reference,refund_amount_cents
      FROM supported_cancellations WHERE status='submitted' AND provider_case_reference IS NOT NULL
      ORDER BY submitted_at LIMIT $1`,[limit]);return result.rows;},

    reconcileSupportedRefund({cancellationId,providerCaseReference,status,amountCents}){return database.transaction(async client=>{
      const row=(await client.query(`SELECT id,transaction_id,payment_intent_id,provider_case_reference,refund_amount_cents,status FROM supported_cancellations
        WHERE id=$1 FOR UPDATE`,[cancellationId])).rows[0];
      if(!row)return{missing:true,completed:false};
      if(row.status==='completed'&&row.provider_case_reference===providerCaseReference&&row.refund_amount_cents===amountCents)return{missing:false,matched:true,completed:true,reused:true};
      const matched=row.status==='submitted'&&row.provider_case_reference===providerCaseReference&&row.refund_amount_cents===amountCents;
      const failureCode=!matched?'refund_reconciliation_mismatch':status==='failed'?'provider_refund_failed':null;
      await client.query(`INSERT INTO supported_refund_reconciliation_checks
        (supported_cancellation_id,provider_case_reference,observed_status,observed_amount_cents,matched,failure_code)
        VALUES($1,$2,$3,$4,$5,$6)`,[cancellationId,providerCaseReference,status,amountCents,matched,failureCode]);
      if(!matched)return{missing:false,matched:false,completed:false,blocked:true};
      if(status==='failed'){
        await client.query(`UPDATE supported_cancellations SET status='failed',execution_failure_code='provider_refund_failed',updated_at=now()
          WHERE id=$1 AND status='submitted'`,[cancellationId]);
        await client.query(`UPDATE supported_refund_alerts SET resolved_at=now(),resolution='Provedor confirmou falha; caso devolvido para análise.'
          WHERE supported_cancellation_id=$1 AND resolved_at IS NULL`,[cancellationId]);
        await client.query(`INSERT INTO audit_events(action,entity_type,entity_id,metadata)
          VALUES('refund.execution.reconciliation_failed','supported_cancellation',$1,$2::jsonb)`,[cancellationId,JSON.stringify({providerCaseReference})]);
        return{missing:false,matched:true,completed:false,blocked:true};
      }
      if(status!=='completed')return{missing:false,matched:true,completed:false,blocked:false};
      await client.query(`UPDATE supported_cancellations SET status='completed',completed_at=now(),completion_source='reconciliation',
        execution_failure_code=NULL,updated_at=now() WHERE id=$1 AND status='submitted'`,[cancellationId]);
      await client.query(`UPDATE payment_intents SET status='refunded',updated_at=now() WHERE id=$1`,[row.payment_intent_id]);
      await client.query(`UPDATE transactions SET status='refunded',updated_at=now() WHERE id=$1 AND status<>'refunded'`,[row.transaction_id]);
      await client.query(`UPDATE supported_refund_alerts SET resolved_at=now(),resolution='Confirmação obtida por reconciliação financeira.'
        WHERE supported_cancellation_id=$1 AND resolved_at IS NULL`,[cancellationId]);
      await client.query(`INSERT INTO audit_events(action,entity_type,entity_id,metadata)
        VALUES('refund.execution.reconciled','supported_cancellation',$1,$2::jsonb)`,
      [cancellationId,JSON.stringify({providerCaseReference,refundAmountCents:amountCents})]);
      return{missing:false,matched:true,completed:true};
    });},
  });
}
