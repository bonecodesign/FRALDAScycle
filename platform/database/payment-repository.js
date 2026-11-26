import {createHash} from 'node:crypto';
import {proportionalWalletRefund} from '../packages/contracts/wallet-payment-allocation.js';

async function releaseWalletPurchase(client,intent,reason){
  const allocation=(await client.query('SELECT courier_id,wallet_cents,status FROM courier_wallet_purchase_allocations WHERE id=$1 FOR UPDATE',[intent.allocation_id])).rows[0];
  if(!allocation||allocation.status!=='reserved')return false;
  const restored=await client.query('UPDATE courier_wallet_accounts SET available_cents=available_cents+$2,reserved_cents=reserved_cents-$2,version=version+1,updated_at=now() WHERE courier_id=$1 AND reserved_cents>=$2',[allocation.courier_id,allocation.wallet_cents]);
  if(restored.rowCount!==1)throw Object.assign(new Error('Saldo reservado inconsistente.'),{code:'wallet_balance_conflict',status:409});
  const balance=(await client.query('SELECT available_cents,reserved_cents FROM courier_wallet_accounts WHERE courier_id=$1',[allocation.courier_id])).rows[0];
  await client.query(`INSERT INTO courier_wallet_entries(courier_id,kind,amount_cents,available_after_cents,reserved_after_cents,source_type,source_id,idempotency_key) VALUES($1,'purchase_release',$2,$3,$4,'marketplace_purchase',$5,$6) ON CONFLICT(idempotency_key) DO NOTHING`,[allocation.courier_id,allocation.wallet_cents,balance.available_cents,balance.reserved_cents,intent.allocation_id,createHash('sha256').update(`purchase-release:${intent.id}`).digest('hex')]);
  await client.query("UPDATE courier_wallet_purchase_allocations SET status='released',updated_at=now() WHERE id=$1",[intent.allocation_id]);
  await client.query(`INSERT INTO audit_events(action,entity_type,entity_id,metadata) VALUES('payment.wallet.released','payment_intent',$1,$2::jsonb)`,[intent.id,JSON.stringify({walletAmountCents:allocation.wallet_cents,reason})]);return true;
}

async function applyWalletPurchaseRefund(client,refund,{externalConfirmedCents=0}={}){
  if(!refund.allocation_id)return false;
  const allocation=(await client.query(`SELECT id,courier_id,wallet_cents,external_cents,wallet_refunded_cents,external_refunded_cents,status
    FROM courier_wallet_purchase_allocations WHERE id=$1 FOR UPDATE`,[refund.allocation_id])).rows[0];
  if(!allocation)throw Object.assign(new Error('Composição da carteira não encontrada.'),{code:'wallet_refund_allocation_missing',status:409});
  const walletRefund=Number(refund.wallet_refund_cents??0),externalRefund=Number(externalConfirmedCents??0);
  if(Number(allocation.wallet_refunded_cents)===walletRefund&&Number(allocation.external_refunded_cents)===externalRefund)return false;
  if(Number(allocation.wallet_refunded_cents)!==0||Number(allocation.external_refunded_cents)!==0)throw Object.assign(new Error('Composição de reembolso da carteira divergente.'),{code:'wallet_refund_conflict',status:409});
  if(walletRefund>0){
    const account=(await client.query(`UPDATE courier_wallet_accounts SET available_cents=available_cents+$2,version=version+1,updated_at=now()
      WHERE courier_id=$1 RETURNING available_cents,reserved_cents`,[allocation.courier_id,walletRefund])).rows[0];
    if(!account)throw Object.assign(new Error('Carteira do comprador não encontrada.'),{code:'wallet_account_missing',status:409});
    await client.query(`INSERT INTO courier_wallet_entries(courier_id,kind,amount_cents,available_after_cents,reserved_after_cents,source_type,source_id,idempotency_key)
      VALUES($1,'purchase_refund',$2,$3,$4,'marketplace_purchase',$5,$6) ON CONFLICT(idempotency_key) DO NOTHING`,[allocation.courier_id,walletRefund,account.available_cents,account.reserved_cents,allocation.id,createHash('sha256').update(`purchase-refund:${refund.id}`).digest('hex')]);
  }
  const totalRefunded=walletRefund+externalRefund,total=Number(allocation.wallet_cents)+Number(allocation.external_cents);
  await client.query(`UPDATE courier_wallet_purchase_allocations SET wallet_refunded_cents=$2,external_refunded_cents=$3,
    status=CASE WHEN $4>=gross_cents THEN 'refunded' ELSE 'partially_refunded' END,updated_at=now() WHERE id=$1`,[allocation.id,walletRefund,externalRefund,totalRefunded]);
  return totalRefunded<=total;
}

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
        c.wallet_refund_cents,c.provider_refund_cents,
        c.reason,c.status,c.provider_case_reference,c.execution_failure_code,c.submitted_at,c.completed_at,c.created_at,c.updated_at
        FROM supported_cancellations c WHERE c.id=$1`,[cancellationId]);
      return result.rows[0]??null;
    },

    async supportedRefundQueue(limit=50){const result=await database.query(`SELECT c.id,c.support_ticket_id,c.refund_amount_cents,c.wallet_refund_cents,c.provider_refund_cents,c.status,
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
      const row=(await client.query(`SELECT c.*,p.provider_reference AS payment_provider_reference,
          a.id AS allocation_id,a.gross_cents AS allocation_gross_cents,a.wallet_cents AS allocation_wallet_cents
        FROM supported_cancellations c JOIN payment_intents p ON p.id=c.payment_intent_id
        LEFT JOIN courier_wallet_purchase_allocations a ON a.payment_intent_id=p.id
        WHERE c.id=$1 FOR UPDATE OF c,p`,[cancellationId])).rows[0];
      if(!row)throw Object.assign(new Error('Decisão de reembolso não encontrada.'),{code:'supported_refund_not_found',status:404});
      if(row.execution_idempotency_key){if(row.execution_idempotency_key!==idempotencyKey)throw Object.assign(new Error('A execução já possui outra chave.'),{code:'refund_execution_conflict',status:409});return{refund:row,reused:true};}
      // Both refund paths serialize on the same payment intent row.
      // A prior external case may have moved money even after a local failure.
      const externalCase=await client.query('SELECT id FROM payment_cases WHERE payment_intent_id=$1 LIMIT 1',[row.payment_intent_id]);
      if(externalCase.rows.length)throw Object.assign(new Error('Existe uma solicitação financeira anterior. Concilie o caso antes de executar o reembolso.'),{code:'refund_cross_path_conflict',status:409});
      const composition=row.allocation_id?proportionalWalletRefund({grossCents:Number(row.allocation_gross_cents),walletCents:Number(row.allocation_wallet_cents),refundCents:Number(row.refund_amount_cents)}):{walletRefundCents:0,externalRefundCents:Number(row.refund_amount_cents)};
      if(row.status!=='provider_pending'||(composition.externalRefundCents>0&&!row.payment_provider_reference)||row.refund_amount_cents<0)throw Object.assign(new Error('Reembolso não está pronto para execução.'),{code:'supported_refund_not_ready',status:409});
      const grant=await stepUpRepository.consume(client,{grantId,userId:actorId,purpose:'refund_execution'});if(!grant)throw Object.assign(new Error('Confirmação financeira inválida ou expirada.'),{code:'refund_step_up_required',status:409});
      const refund=(await client.query(`UPDATE supported_cancellations SET status='submitted',execution_idempotency_key=$2,
        executed_by=$3,submitted_at=now(),execution_failure_code=NULL,wallet_refund_cents=$4,provider_refund_cents=$5,updated_at=now() WHERE id=$1 RETURNING *`,[cancellationId,idempotencyKey,actorId,composition.walletRefundCents,composition.externalRefundCents])).rows[0];
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'refund.execution.reserved','supported_cancellation',$2,$3::jsonb)`,[actorId,cancellationId,JSON.stringify({refundAmountCents:refund.refund_amount_cents,idempotencyKey})]);
      return{refund:{...refund,payment_provider_reference:row.payment_provider_reference,allocation_id:row.allocation_id},reused:false};
    });},
    completeWalletSupportedRefund({actorId,cancellationId}){return database.transaction(async client=>{
      const refund=(await client.query(`SELECT c.*,a.id AS allocation_id FROM supported_cancellations c
        LEFT JOIN courier_wallet_purchase_allocations a ON a.payment_intent_id=c.payment_intent_id
        WHERE c.id=$1 FOR UPDATE OF c`,[cancellationId])).rows[0];
      if(!refund||refund.status!=='submitted'||Number(refund.provider_refund_cents)!==0)throw Object.assign(new Error('Reembolso local não está pronto.'),{code:'wallet_refund_not_ready',status:409});
      await applyWalletPurchaseRefund(client,refund);
      const completed=(await client.query(`UPDATE supported_cancellations SET status='completed',completed_at=now(),completion_source='local_wallet',
        execution_failure_code=NULL,updated_at=now() WHERE id=$1 RETURNING *`,[cancellationId])).rows[0];
      await client.query("UPDATE payment_intents SET status='refunded',updated_at=now() WHERE id=$1",[refund.payment_intent_id]);
      await client.query("UPDATE transactions SET status='refunded',updated_at=now() WHERE id=$1 AND status<>'refunded'",[refund.transaction_id]);
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'refund.execution.completed','supported_cancellation',$2,$3::jsonb)`,[actorId,cancellationId,JSON.stringify({completionSource:'local_wallet',refundAmountCents:refund.refund_amount_cents})]);
      return completed;
    });},
    finishSupportedRefund({actorId,cancellationId,providerCaseReference}){return database.transaction(async client=>{const refund=(await client.query(`UPDATE supported_cancellations SET provider_case_reference=$2,execution_failure_code=NULL,updated_at=now()
      WHERE id=$1 AND status='submitted' RETURNING *`,[cancellationId,providerCaseReference])).rows[0];if(!refund)return null;await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      VALUES($1,'refund.execution.submitted','supported_cancellation',$2,$3::jsonb)`,[actorId,cancellationId,JSON.stringify({providerCaseReference})]);return refund;});},
    failSupportedRefund({actorId,cancellationId,failureCode}){return database.transaction(async client=>{const refund=(await client.query(`UPDATE supported_cancellations SET status='failed',execution_failure_code=$2,updated_at=now()
      WHERE id=$1 AND status='submitted' RETURNING *`,[cancellationId,failureCode])).rows[0];if(refund)await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      VALUES($1,'refund.execution.failed','supported_cancellation',$2,$3::jsonb)`,[actorId,cancellationId,JSON.stringify({failureCode})]);return refund;});},

    // Read-only, buyer-scoped status. Never return provider payloads or secrets.
    async intentStatus({ buyerId, transactionId, intentId }) {
      const result = await database.query(`
        SELECT p.id,p.transaction_id,p.status,p.amount_cents
        FROM payment_intents p JOIN transactions t ON t.id=p.transaction_id
        WHERE p.id=$1 AND p.transaction_id=$2 AND p.buyer_id=$3 AND t.buyer_id=$3
      `,[intentId,transactionId,buyerId]);
      return result.rows[0] ?? null;
    },

    async checkoutPreview({ buyerId, transactionId }) {
      const result = await database.query(`
        SELECT t.id, t.status, t.amount_cents, l.kind,u.role AS buyer_role,
          COALESCE(w.available_cents,0) AS wallet_available_cents,
          q.id AS quote_id, q.status AS quote_status, q.provider AS quote_provider,
          q.base_freight_cents, q.platform_fee_cents AS freight_platform_fee_cents,
          q.customer_total_cents, q.expires_at AS quote_expires_at,
          q.confirmed_by AS quote_confirmed_by
        FROM transactions t
        JOIN listings l ON l.id = t.listing_id
        JOIN users u ON u.id=t.buyer_id
        LEFT JOIN courier_wallet_accounts w ON w.courier_id=t.buyer_id
        LEFT JOIN LATERAL (
          SELECT id,status,provider,base_freight_cents,platform_fee_cents,
            customer_total_cents,expires_at,confirmed_by
          FROM delivery_quotes
          WHERE transaction_id=t.id AND shipment_id IS NULL
            AND status IN ('quoted','confirmed','locked')
          ORDER BY created_at DESC,id DESC LIMIT 1
        ) q ON true
        WHERE t.id=$1 AND t.buyer_id=$2
      `, [transactionId,buyerId]);
      return result.rows[0] ?? null;
    },

    async context({ buyerId, transactionId, idempotencyKey }) {
      return database.transaction(async (client) => {
        const existing = await client.query(
          `SELECT p.id,p.transaction_id,p.buyer_id,p.method,p.amount_cents,p.platform_fee_cents,
                  p.delivery_fee_cents,p.seller_amount_cents,p.wallet_amount_cents,p.provider_charge_cents,p.provider_reference,p.status,p.checkout_payload
           FROM payment_intents p JOIN transactions t ON t.id=p.transaction_id
           WHERE p.idempotency_key=$1 AND p.transaction_id=$2 AND p.buyer_id=$3 AND t.buyer_id=$3`,
          [idempotencyKey,transactionId,buyerId],
        );
        if (existing.rows[0]) return { existing: true, intent: existing.rows[0] };
        const transaction = await client.query(
          `SELECT t.id, t.buyer_id, t.seller_id, t.status, t.amount_cents, l.kind,u.role AS buyer_role,
             COALESCE(w.available_cents,0) AS wallet_available_cents,
             EXISTS (SELECT 1 FROM delivery_quotes q
               WHERE q.transaction_id=t.id AND q.shipment_id IS NULL
                 AND q.status IN ('quoted','confirmed','locked')) AS active_delivery_quote
           FROM transactions t JOIN listings l ON l.id = t.listing_id JOIN users u ON u.id=t.buyer_id
           LEFT JOIN courier_wallet_accounts w ON w.courier_id=t.buyer_id
           WHERE t.id = $1 AND t.buyer_id = $2 FOR UPDATE OF t`,
          [transactionId, buyerId],
        );
        return { existing: false, transaction: transaction.rows[0] ?? null };
      });
    },

    async createIntent(input) {
      return database.transaction(async (client) => {
        const eligibility = await client.query(`SELECT id FROM transactions
          WHERE id=$1 AND buyer_id=$2 AND status IN ('initiated','payment_pending')
            AND NOT EXISTS (SELECT 1 FROM delivery_quotes q WHERE q.transaction_id=transactions.id
              AND q.shipment_id IS NULL AND q.status IN ('quoted','confirmed','locked'))
          FOR UPDATE`,
          [input.transactionId,input.buyerId]);
        if (!eligibility.rows[0]) throw Object.assign(new Error("Transação indisponível ou frete ainda sem liquidação homologada."), {code:"transaction_not_payable",status:409});
        // The transaction row lock serializes payment creation for this purchase.
        // Query AFTER acquiring it, using a fresh READ COMMITTED statement.
        // Even a failed/uncertain intent requires reconciliation before a new key.
        const prior=await client.query('SELECT id FROM payment_intents WHERE transaction_id=$1 LIMIT 1',[input.transactionId]);
        if(prior.rows.length)throw Object.assign(new Error('Já existe uma tentativa de pagamento. Consulte a operação antes de tentar novamente.'),{code:'payment_attempt_conflict',status:409});
        if(input.walletAmountCents>0){const wallet=(await client.query('SELECT available_cents,reserved_cents FROM courier_wallet_accounts WHERE courier_id=$1 FOR UPDATE',[input.buyerId])).rows[0];if(!wallet||wallet.available_cents<input.walletAmountCents)throw Object.assign(new Error('Saldo da carteira insuficiente.'),{code:'wallet_insufficient_balance',status:409});}
        const created = await client.query(
          `INSERT INTO payment_intents
             (transaction_id, buyer_id, idempotency_key, method, amount_cents,
              platform_fee_cents, delivery_fee_cents, seller_amount_cents,wallet_amount_cents)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (idempotency_key) DO NOTHING
           RETURNING *`,
          [input.transactionId, input.buyerId, input.idempotencyKey, input.method,
           input.amountCents, input.platformFeeCents, input.deliveryFeeCents, input.sellerAmountCents,input.walletAmountCents],
        );
        if(!created.rows[0])throw Object.assign(new Error('Não foi possível reservar a tentativa. Consulte a operação antes de tentar novamente.'),{code:'payment_attempt_conflict',status:409});
        if(input.walletAmountCents>0){
          await client.query('UPDATE courier_wallet_accounts SET available_cents=available_cents-$2,reserved_cents=reserved_cents+$2,version=version+1,updated_at=now() WHERE courier_id=$1',[input.buyerId,input.walletAmountCents]);
          const allocation=(await client.query(`INSERT INTO courier_wallet_purchase_allocations(transaction_id,payment_intent_id,courier_id,gross_cents,wallet_cents,external_cents,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[input.transactionId,created.rows[0].id,input.buyerId,input.amountCents,input.walletAmountCents,input.providerChargeCents,`wallet-purchase:${input.idempotencyKey}`])).rows[0];
          const balance=(await client.query('SELECT available_cents,reserved_cents FROM courier_wallet_accounts WHERE courier_id=$1',[input.buyerId])).rows[0];
          await client.query(`INSERT INTO courier_wallet_entries(courier_id,kind,amount_cents,available_after_cents,reserved_after_cents,source_type,source_id,idempotency_key) VALUES($1,'purchase_reserve',$2,$3,$4,'marketplace_purchase',$5,$6)`,[input.buyerId,input.walletAmountCents,balance.available_cents,balance.reserved_cents,allocation.id,createHash('sha256').update(`purchase-reserve:${input.idempotencyKey}`).digest('hex')]);
        }
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

    async completeWalletPayment({intentId,buyerId,idempotencyKey}){return database.transaction(async client=>{
      const intent=(await client.query(`SELECT p.*,a.id AS allocation_id,a.wallet_cents,a.status AS allocation_status FROM payment_intents p JOIN courier_wallet_purchase_allocations a ON a.payment_intent_id=p.id WHERE p.id=$1 AND p.buyer_id=$2 FOR UPDATE OF p,a`,[intentId,buyerId])).rows[0];
      if(!intent||intent.method!=='wallet'||intent.provider_charge_cents!==0)throw Object.assign(new Error('Pagamento integral pela carteira inválido.'),{code:'wallet_payment_invalid',status:409});
      if(intent.status==='paid')return intent;if(intent.status!=='provider_pending'||intent.allocation_status!=='reserved')throw Object.assign(new Error('Pagamento não pode ser concluído.'),{code:'wallet_payment_state_conflict',status:409});
      await client.query('UPDATE courier_wallet_accounts SET reserved_cents=reserved_cents-$2,version=version+1,updated_at=now() WHERE courier_id=$1 AND reserved_cents>=$2',[buyerId,intent.wallet_cents]);
      const balance=(await client.query('SELECT available_cents,reserved_cents FROM courier_wallet_accounts WHERE courier_id=$1',[buyerId])).rows[0];
      await client.query(`INSERT INTO courier_wallet_entries(courier_id,kind,amount_cents,available_after_cents,reserved_after_cents,source_type,source_id,idempotency_key) VALUES($1,'purchase_debit',$2,$3,$4,'marketplace_purchase',$5,$6)`,[buyerId,intent.wallet_cents,balance.available_cents,balance.reserved_cents,intent.allocation_id,createHash('sha256').update(`purchase-paid:${idempotencyKey}`).digest('hex')]);
      await client.query("UPDATE courier_wallet_purchase_allocations SET status='paid',updated_at=now() WHERE id=$1",[intent.allocation_id]);
      const paid=(await client.query("UPDATE payment_intents SET status='paid',updated_at=now() WHERE id=$1 RETURNING *",[intent.id])).rows[0];
      await client.query("UPDATE transactions SET status='paid',updated_at=now() WHERE id=$1 AND status='payment_pending'",[intent.transaction_id]);
      await client.query(`INSERT INTO transaction_contact_access(transaction_id,payment_intent_id,wallet_purchase_allocation_id) VALUES($1,$2,$3) ON CONFLICT(transaction_id) DO UPDATE SET payment_intent_id=EXCLUDED.payment_intent_id,wallet_purchase_allocation_id=EXCLUDED.wallet_purchase_allocation_id,unlocked_at=now(),revoked_at=NULL,revoked_by=NULL,revocation_reason=NULL`,[intent.transaction_id,intent.id,intent.allocation_id]);
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'payment.wallet.completed','payment_intent',$2,$3::jsonb)`,[buyerId,intent.id,JSON.stringify({walletAmountCents:intent.wallet_cents,externalChargeCreated:false})]);return paid;
    });},

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
          `SELECT c.id,c.payment_intent_id,c.requester_id,c.kind,c.reason,c.details,c.status
           FROM payment_cases c JOIN payment_intents p ON p.id=c.payment_intent_id
           JOIN transactions t ON t.id=p.transaction_id
           WHERE c.idempotency_key=$1 AND c.payment_intent_id=$2 AND c.requester_id=$3
             AND p.buyer_id=$3 AND t.buyer_id=$3`,
          [idempotencyKey,intentId,requesterId],
        );
        if (existing.rows[0]) return { existing: true, paymentCase: existing.rows[0] };
        const intent = await client.query(
          `SELECT p.id, p.provider_reference, p.status, p.amount_cents,p.wallet_amount_cents,p.provider_charge_cents, t.buyer_id, t.status AS transaction_status
           FROM payment_intents p JOIN transactions t ON t.id = p.transaction_id
           WHERE p.id = $1 AND p.buyer_id = $2 AND t.buyer_id = $2 FOR UPDATE OF p`,
          [intentId, requesterId],
        );
        return { existing: false, intent: intent.rows[0] ?? null };
      });
    },

    async createCase(input) {
      return database.transaction(async (client) => {
        // Recheck ownership and eligibility under a row lock; the earlier
        // context transaction has already ended.
        const locked=(await client.query(`
          SELECT p.id,p.status,p.provider_reference,p.amount_cents,p.wallet_amount_cents,p.provider_charge_cents
          FROM payment_intents p JOIN transactions t ON t.id=p.transaction_id
          WHERE p.id=$1 AND p.buyer_id=$2 AND t.buyer_id=$2 FOR UPDATE OF p
        `,[input.intentId,input.requesterId])).rows[0];
        if(!locked)throw Object.assign(new Error('Pagamento não encontrado.'),{code:'payment_not_found',status:404});
        if(locked.wallet_amount_cents!==0||locked.provider_charge_cents!==locked.amount_cents){
          throw Object.assign(new Error('Pagamento com carteira ou composição financeira divergente exige análise do suporte.'),{code:'payment_case_requires_support',status:409});
        }
        const eligible=input.kind==='refund'?['paid','authorized']:input.kind==='dispute'?['paid','authorized','disputed']:[];
        if(!eligible.includes(locked.status)||!locked.provider_reference||
           locked.provider_reference!==input.expectedProviderReference||locked.amount_cents!==input.expectedAmountCents)
          throw Object.assign(new Error('A situação financeira mudou. Consulte o pagamento novamente.'),{code:'payment_case_conflict',status:409});
        // A new key cannot repeat an existing request of the same kind.
        // Failed/ambiguous attempts require support reconciliation first.
        const prior=await client.query('SELECT id FROM payment_cases WHERE payment_intent_id=$1 AND kind=$2::payment_case_kind LIMIT 1',[input.intentId,input.kind]);
        if(prior.rows.length)throw Object.assign(new Error('Já existe uma solicitação deste tipo. Acompanhe a operação pelo suporte.'),{code:'payment_case_conflict',status:409});
        // A supported cancellation may already have reserved or returned funds.
        // Never bypass its financial snapshot, including ambiguous failures.
        const assisted=await client.query('SELECT id FROM supported_cancellations WHERE payment_intent_id=$1 LIMIT 1',[input.intentId]);
        if(assisted.rows.length)throw Object.assign(new Error('Existe um cancelamento assistido. Acompanhe a conciliação pelo suporte.'),{code:'refund_cross_path_conflict',status:409});
        const created = await client.query(
          `INSERT INTO payment_cases
             (payment_intent_id, requester_id, kind, idempotency_key, reason, details)
           VALUES ($1,$2,$3::payment_case_kind,$4,$5,$6)
           ON CONFLICT (idempotency_key) DO NOTHING
           RETURNING *`,
          [input.intentId, input.requesterId, input.kind, input.idempotencyKey, input.reason, input.details],
        );
        if(!created.rows[0])throw Object.assign(new Error('Não foi possível registrar uma nova solicitação. Consulte o suporte.'),{code:'payment_case_conflict',status:409});
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
      // A rejected event must not consume its idempotency key. The sentinel
      // belongs to this call only; the database wrapper rolls back on throw.
      const rejected=new Error('financial webhook requires reconciliation');
      let rejection=null;
      try{return await database.transaction(async (client) => {
        const inserted = await client.query(
          `INSERT INTO payment_webhook_events
             (id, event_type, provider_reference, occurred_at, payload_hash)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING RETURNING id`,
          [event.id, event.type, event.providerReference, event.occurredAt, event.payloadHash],
        );
        if (!inserted.rows[0]) {
          const prior=(await client.query('SELECT payload_hash FROM payment_webhook_events WHERE id=$1',[event.id])).rows[0];
          if(!prior||!Buffer.isBuffer(prior.payload_hash)||!Buffer.isBuffer(event.payloadHash)||!prior.payload_hash.equals(event.payloadHash)){
            return {eventConflict:true};
          }
          return {duplicate:true};
        }
        const found = await client.query(
          `SELECT p.id, p.transaction_id, p.amount_cents, p.provider_charge_cents, p.wallet_amount_cents, p.status,
             a.id AS allocation_id,a.status AS allocation_status,t.status AS transaction_status
           FROM payment_intents p JOIN transactions t ON t.id=p.transaction_id
           LEFT JOIN courier_wallet_purchase_allocations a ON a.payment_intent_id=p.id
           WHERE p.provider_reference = $1 FOR UPDATE OF p,t`,
          [event.providerReference],
        );
        const intent = found.rows[0];
        if (!intent) {rejection={missing:true};throw rejected;}
        const supportedRefund=event.type==='payment.refunded'?(await client.query(`SELECT id,refund_amount_cents,wallet_refund_cents,provider_refund_cents,status
          FROM supported_cancellations
          WHERE payment_intent_id=$1 AND status='submitted' FOR UPDATE`,[intent.id])).rows[0]:null;
        if(supportedRefund)supportedRefund.allocation_id=intent.allocation_id;
        const expectedAmount=supportedRefund?(supportedRefund.provider_refund_cents??supportedRefund.refund_amount_cents):(intent.provider_charge_cents??intent.amount_cents);
        if (expectedAmount !== event.amountCents) {rejection={amountMismatch:true};throw rejected;}

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
        // A confirmed payment must never revive a cancelled transaction or
        // consume a released wallet reservation. Reconciliation is required.
        if(event.type==='payment.paid'){
          if(['failed','cancelled'].includes(intent.status)||
             (intent.wallet_amount_cents>0&&!['reserved','paid'].includes(intent.allocation_status))){
            rejection={stateConflict:true};throw rejected;
          }
          if(intent.status==='paid'&&intent.transaction_status==='paid'){
            return {ignored:true,status:'paid'};
          }
          if(!['initiated','payment_pending'].includes(intent.transaction_status)){
            rejection={stateConflict:true};throw rejected;
          }
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
        if(event.type==='payment.paid'&&intent.wallet_amount_cents>0&&intent.allocation_status==='reserved'){
          await client.query('UPDATE courier_wallet_accounts SET reserved_cents=reserved_cents-$2,version=version+1,updated_at=now() WHERE courier_id=(SELECT courier_id FROM courier_wallet_purchase_allocations WHERE id=$1) AND reserved_cents>=$2',[intent.allocation_id,intent.wallet_amount_cents]);
          const allocation=(await client.query('SELECT courier_id FROM courier_wallet_purchase_allocations WHERE id=$1',[intent.allocation_id])).rows[0];
          const balance=(await client.query('SELECT available_cents,reserved_cents FROM courier_wallet_accounts WHERE courier_id=$1',[allocation.courier_id])).rows[0];
          await client.query(`INSERT INTO courier_wallet_entries(courier_id,kind,amount_cents,available_after_cents,reserved_after_cents,source_type,source_id,idempotency_key) VALUES($1,'purchase_debit',$2,$3,$4,'marketplace_purchase',$5,$6)`,[allocation.courier_id,intent.wallet_amount_cents,balance.available_cents,balance.reserved_cents,intent.allocation_id,createHash('sha256').update(`purchase-paid:${intent.id}`).digest('hex')]);
          await client.query("UPDATE courier_wallet_purchase_allocations SET status='paid',updated_at=now() WHERE id=$1",[intent.allocation_id]);
        }
        if(event.type==='payment.failed'&&intent.wallet_amount_cents>0&&intent.allocation_status==='reserved')await releaseWalletPurchase(client,intent,'provider_failed');
        if(supportedRefund){
          await applyWalletPurchaseRefund(client,supportedRefund,{externalConfirmedCents:Number(supportedRefund.provider_refund_cents)});
          await client.query(`UPDATE supported_cancellations SET status='completed',completed_at=$2,completion_source='webhook',
            completion_webhook_event_id=$3,execution_failure_code=NULL,updated_at=now() WHERE id=$1 AND status='submitted'`,
          [supportedRefund.id,event.occurredAt,event.id]);
          await client.query(`INSERT INTO audit_events(action,entity_type,entity_id,metadata)
            VALUES('refund.execution.completed','supported_cancellation',$1,$2::jsonb)`,
          [supportedRefund.id,JSON.stringify({eventId:event.id,providerRefundCents:event.amountCents,walletRefundCents:supportedRefund.wallet_refund_cents})]);
          await client.query(`UPDATE supported_refund_alerts SET resolved_at=now(),resolution='Confirmação recebida por webhook financeiro.'
            WHERE supported_cancellation_id=$1 AND resolved_at IS NULL`,[supportedRefund.id]);
        }
        if (event.type === "payment.paid") {
          await client.query(
            `INSERT INTO transaction_contact_access(transaction_id,payment_intent_id)
             SELECT t.id,$2 FROM transactions t JOIN listings l ON l.id=t.listing_id
             WHERE t.id=$1 AND l.kind='sale' AND t.status='paid'
             ON CONFLICT (transaction_id) DO NOTHING`,
            [intent.transaction_id,intent.id],
          );
        }
        const paymentMessage = {
          "payment.authorized": "O pagamento foi autorizado e continua em processamento.",
          "payment.paid": "O pagamento foi confirmado.",
          "payment.failed": "O pagamento não foi concluído. Consulte a operação antes de tentar novamente.",
          "payment.refunded": "O reembolso do pagamento foi confirmado.",
          "payment.disputed": "O pagamento entrou em disputa e aguarda análise.",
        }[event.type];
        await client.query(
          `INSERT INTO account_notices(user_id,kind,message,dedupe_key)
           SELECT participant.user_id,'operational_payment',$2,
             'operational-payment:'||$3||':'||participant.user_id::text
           FROM transactions t
           CROSS JOIN LATERAL unnest(ARRAY[t.buyer_id,t.seller_id]) AS participant(user_id)
           WHERE t.id=$1
           ON CONFLICT(dedupe_key) DO NOTHING`,
          [intent.transaction_id,paymentMessage,event.id],
        );
        await client.query(
          `INSERT INTO notification_outbox(kind,recipient,payload,recipient_user_id)
           SELECT 'operational_required_notice',u.email,$2::jsonb,u.id
           FROM transactions t
           CROSS JOIN LATERAL (VALUES(t.buyer_id),(t.seller_id)) AS participant(user_id)
           JOIN users u ON u.id=participant.user_id
           WHERE t.id=$1 AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL`,
          [intent.transaction_id,JSON.stringify({channel:'email',event:event.type})],
        );
        await client.query(
          `INSERT INTO audit_events (action, entity_type, entity_id, metadata)
           VALUES ('payment.webhook.processed', 'payment_intent', $1, $2::jsonb)`,
          [intent.id, JSON.stringify({ eventId: event.id, eventType: event.type })],
        );
        return { duplicate: false, status: intentStatus, supportedRefundCompleted:Boolean(supportedRefund) };
      });}catch(error){if(error===rejected&&rejection)return rejection;throw error;}
    },

    async markProviderFailure({ intentId, failureCode }) {
      await database.transaction(async client=>{const intent=(await client.query(`SELECT p.id,p.buyer_id,p.wallet_amount_cents,a.id AS allocation_id,a.status AS allocation_status FROM payment_intents p LEFT JOIN courier_wallet_purchase_allocations a ON a.payment_intent_id=p.id WHERE p.id=$1 FOR UPDATE OF p`,[intentId])).rows[0];if(!intent)return;
        await client.query(`UPDATE payment_intents SET status='failed',failure_code=$2,updated_at=now() WHERE id=$1 AND status='provider_pending'`,[intentId,failureCode]);
        if(intent.wallet_amount_cents>0&&intent.allocation_status==='reserved')await releaseWalletPurchase(client,intent,failureCode);
      });
    },

    async pendingSupportedRefunds(limit=20){const result=await database.query(`SELECT id,provider_case_reference,provider_refund_cents AS refund_amount_cents
      FROM supported_cancellations WHERE status='submitted' AND provider_case_reference IS NOT NULL
      ORDER BY submitted_at LIMIT $1`,[limit]);return result.rows;},

    reconcileSupportedRefund({cancellationId,providerCaseReference,status,amountCents}){return database.transaction(async client=>{
      const row=(await client.query(`SELECT c.id,c.transaction_id,c.payment_intent_id,c.provider_case_reference,c.refund_amount_cents,
          c.wallet_refund_cents,c.provider_refund_cents,c.status,a.id AS allocation_id FROM supported_cancellations c
        LEFT JOIN courier_wallet_purchase_allocations a ON a.payment_intent_id=c.payment_intent_id
        WHERE c.id=$1 FOR UPDATE OF c`,[cancellationId])).rows[0];
      if(!row)return{missing:true,completed:false};
      const expectedProviderRefund=Number(row.provider_refund_cents??row.refund_amount_cents);
      if(row.status==='completed'&&row.provider_case_reference===providerCaseReference&&expectedProviderRefund===amountCents)return{missing:false,matched:true,completed:true,reused:true};
      const matched=row.status==='submitted'&&row.provider_case_reference===providerCaseReference&&expectedProviderRefund===amountCents;
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
      await applyWalletPurchaseRefund(client,row,{externalConfirmedCents:Number(row.provider_refund_cents)});
      await client.query(`UPDATE supported_cancellations SET status='completed',completed_at=now(),completion_source='reconciliation',
        execution_failure_code=NULL,updated_at=now() WHERE id=$1 AND status='submitted'`,[cancellationId]);
      await client.query(`UPDATE payment_intents SET status='refunded',updated_at=now() WHERE id=$1`,[row.payment_intent_id]);
      await client.query(`UPDATE transactions SET status='refunded',updated_at=now() WHERE id=$1 AND status<>'refunded'`,[row.transaction_id]);
      await client.query(`UPDATE supported_refund_alerts SET resolved_at=now(),resolution='Confirmação obtida por reconciliação financeira.'
        WHERE supported_cancellation_id=$1 AND resolved_at IS NULL`,[cancellationId]);
      await client.query(`INSERT INTO audit_events(action,entity_type,entity_id,metadata)
        VALUES('refund.execution.reconciled','supported_cancellation',$1,$2::jsonb)`,
      [cancellationId,JSON.stringify({providerCaseReference,providerRefundCents:amountCents,walletRefundCents:row.wallet_refund_cents})]);
      return{missing:false,matched:true,completed:true};
    });},
  });
}
