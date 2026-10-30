import { ServiceError } from "./service-error.js";
import { saleSplit } from "../../packages/contracts/commercial-rules.js";
import { verifyBillingCpf } from "../../packages/contracts/payment-billing-identity.js";
import { requireAccessLevel } from './authorization.js';
export class PaymentError extends ServiceError {
  constructor(code, status, message) {
    super(code, status, message);
  }
}

const METHODS = new Set(["pix", "credit"]);
const PAYABLE_STATUSES = new Set(["initiated", "payment_pending"]);
const INTENT_FIELDS = new Set(["transactionId", "idempotencyKey", "method", "paymentMethodToken", "billingCpf", "deliveryRequested"]);
const RAW_CARD_FIELDS = new Set(["cardNumber", "cvv", "pan", "securityCode", "expiry", "expires"]);

function publicIntent(intent) {
  return {
    id: intent.id,
    transactionId: intent.transaction_id,
    method: intent.method,
    amountCents: intent.amount_cents,
    platformFeeCents: intent.platform_fee_cents,
    deliveryFeeCents: intent.delivery_fee_cents,
    sellerAmountCents: intent.seller_amount_cents,
    status: intent.status,
    checkout: intent.checkout_payload ?? {},
  };
}

export function createPaymentService(repository, provider, { cpfHmacSecret = null } = {}) {
  return Object.freeze({
    async supportedRefundQueue(actor){requireAccessLevel(actor,3);const rows=await repository.supportedRefundQueue(50);return{items:rows.map(row=>({id:row.id,supportTicketId:row.support_ticket_id,refundAmountCents:row.refund_amount_cents,status:row.status,submittedAt:row.submitted_at??null,completedAt:row.completed_at??null,failureCode:row.execution_failure_code??null,alert:row.alert_id?{id:row.alert_id,kind:'provider_confirmation_overdue',createdAt:row.alert_created_at}:null}))};},
    async supportedRefundHistory(actor,cancellationId){requireAccessLevel(actor,3);if(!/^[0-9a-f-]{36}$/i.test(cancellationId))throw new PaymentError('invalid_supported_refund',422,'Decisão de reembolso inválida.');const history=await repository.supportedRefundHistory(cancellationId);return{checks:history.checks.map(row=>({status:row.observed_status,amountCents:row.observed_amount_cents,matched:row.matched,failureCode:row.failure_code??null,checkedAt:row.checked_at})),reviews:history.reviews.map(row=>({id:row.id,action:row.action,note:row.note,actorName:row.actor_name,createdAt:row.created_at}))};},
    async reviewBlockedSupportedRefund(actor,cancellationId,input){requireAccessLevel(actor,3);const action=String(input?.action??''),note=String(input?.note??'').trim();if(!/^[0-9a-f-]{36}$/i.test(cancellationId)||!['provider_follow_up','support_reanalysis'].includes(action)||note.length<10||note.length>1000||Object.keys(input??{}).some(key=>!['action','note'].includes(key)))throw new PaymentError('invalid_supported_refund_review',422,'Informe encaminhamento e justificativa válidos.');return{review:await repository.addSupportedRefundReview({actorId:actor.id,cancellationId,action,note})};},
    async supportedRefundStatus(actor,cancellationId){
      requireAccessLevel(actor,3);
      if(!/^[0-9a-f-]{36}$/i.test(cancellationId))throw new PaymentError('invalid_supported_refund',422,'Decisão de reembolso inválida.');
      const row=await repository.supportedRefundStatus(cancellationId);
      if(!row)throw new PaymentError('supported_refund_not_found',404,'Decisão de reembolso não encontrada.');
      return{refund:{id:row.id,transactionId:row.transaction_id,supportTicketId:row.support_ticket_id,phase:row.cancellation_phase,
        grossAmountCents:row.gross_amount_cents,retainedPlatformFeeCents:row.retained_platform_fee_cents,
        retainedDeliveryFeeCents:row.retained_delivery_fee_cents,refundAmountCents:row.refund_amount_cents,
        reason:row.reason,status:row.status,providerCaseReference:row.provider_case_reference??null,
        failureCode:row.execution_failure_code??null,submittedAt:row.submitted_at??null,completedAt:row.completed_at??null,
        createdAt:row.created_at,updatedAt:row.updated_at,executable:row.status==='provider_pending'}};
    },
    async executeSupportedRefund(actor,cancellationId,input){
      requireAccessLevel(actor,3);const idempotencyKey=String(input?.idempotencyKey??''),grantId=String(input?.grantId??'');
      if(input?.confirmed!==true||!/^[0-9a-f-]{36}$/i.test(cancellationId)||!/^[0-9a-f-]{36}$/i.test(idempotencyKey)||!/^[0-9a-f-]{36}$/i.test(grantId))throw new PaymentError('invalid_refund_execution',422,'Confirme a execução com chaves válidas.');
      const reserved=await repository.reserveSupportedRefund({actorId:actor.id,cancellationId,idempotencyKey,grantId});if(reserved.reused)return reserved;
      try{const remote=await provider.createCase({caseId:cancellationId,kind:'refund',idempotencyKey,reason:reserved.refund.reason,details:'Reembolso assistido aprovado pelo suporte.',providerReference:reserved.refund.payment_provider_reference,amountCents:reserved.refund.refund_amount_cents});
        const refund=await repository.finishSupportedRefund({actorId:actor.id,cancellationId,providerCaseReference:remote.providerReference});return{refund,reused:false};
      }catch(error){await repository.failSupportedRefund({actorId:actor.id,cancellationId,failureCode:error.code??'provider_error'});throw error;}
    },
    async createCase(requesterId, intentId, kind, input) {
      if (!["refund", "dispute"].includes(kind)) throw new PaymentError("invalid_payment_case", 422, "Solicitação financeira inválida.");
      const idempotencyKey = String(input?.idempotencyKey ?? "").trim();
      const reason = String(input?.reason ?? "").trim();
      const details = String(input?.details ?? "").trim();
      if (idempotencyKey.length < 16 || idempotencyKey.length > 128) throw new PaymentError("invalid_idempotency_key", 422, "Chave de idempotência inválida.");
      if (reason.length < 2 || reason.length > 80) throw new PaymentError("invalid_case_reason", 422, "Selecione um motivo válido.");
      if (details.length < 10 || details.length > 2000) throw new PaymentError("invalid_case_details", 422, "Descreva a situação com pelo menos 10 caracteres.");
      const context = await repository.caseContext({ requesterId, intentId, idempotencyKey });
      if (context.existing) return { paymentCase: context.paymentCase, reused: true };
      const intent = context.intent;
      if (!intent) throw new PaymentError("payment_not_found", 404, "Pagamento não encontrado.");
      if (!intent.provider_reference) throw new PaymentError("payment_not_submitted", 409, "Pagamento ainda não foi enviado ao provedor.");
      const allowed = kind === "refund"
        ? ["paid", "authorized"].includes(intent.status)
        : ["paid", "authorized", "disputed"].includes(intent.status);
      if (!allowed) throw new PaymentError("payment_case_not_allowed", 409, "Esta solicitação não está disponível para o pagamento.");
      const created = await repository.createCase({
        requesterId, intentId, kind, idempotencyKey, reason, details,
      });
      try {
        const remote = await provider.createCase({
          caseId: created.id, kind, idempotencyKey, reason, details,
          providerReference: intent.provider_reference, amountCents: intent.amount_cents,
        });
        const attached = await repository.attachCaseProvider({
          caseId: created.id, providerReference: remote.providerReference, status: remote.status,
        });
        return { paymentCase: attached, reused: false };
      } catch (error) {
        await repository.markCaseFailure({ caseId: created.id, failureCode: error.code ?? "provider_error" });
        throw error;
      }
    },

    async tokenizationSession(userId) {
      return provider.createTokenizationSession({ userId });
    },

    async processWebhook(event) {
      const result = await repository.processWebhook(event);
      if (result.missing) throw new PaymentError("payment_not_found", 404, "Pagamento não encontrado.");
      if (result.amountMismatch) throw new PaymentError("payment_amount_mismatch", 409, "Valor do evento financeiro não confere.");
      return { accepted: true, duplicate: Boolean(result.duplicate), status: result.status ?? null,
        ...(result.ignored ? { ignored: true } : {}) };
    },

    async createIntent(buyerId, input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new PaymentError("invalid_payment_payload", 422, "Dados de pagamento inválidos.");
      }
      if (Object.keys(input).some(key => RAW_CARD_FIELDS.has(key))) {
        throw new PaymentError("raw_card_data_forbidden", 422, "Dados brutos de cartão não são aceitos.");
      }
      if (Object.keys(input).some(key => !INTENT_FIELDS.has(key))) {
        throw new PaymentError("invalid_payment_payload", 422, "Dados de pagamento inválidos.");
      }
      const transactionId = String(input?.transactionId ?? "");
      const idempotencyKey = String(input?.idempotencyKey ?? "").trim();
      const method = String(input?.method ?? "");
      const paymentMethodToken = String(input?.paymentMethodToken ?? "").trim() || null;
      if (!/^[0-9a-f-]{36}$/i.test(transactionId)) throw new PaymentError("invalid_transaction", 422, "Transação inválida.");
      if (idempotencyKey.length < 16 || idempotencyKey.length > 128) throw new PaymentError("invalid_idempotency_key", 422, "Chave de idempotência inválida.");
      if (!METHODS.has(method)) throw new PaymentError("invalid_payment_method", 422, "Método de pagamento inválido.");
      if (method === "credit" && !paymentMethodToken) {
        throw new PaymentError("payment_token_required", 422, "Tokenize o cartão antes de continuar.");
      }
      let billingCpf = null;
      if (method === "credit") {
        const identity = await repository.billingIdentity?.(buyerId);
        if (!identity?.cpf_fingerprint) {
          throw new PaymentError("billing_identity_unavailable", 409, "Conclua o cadastro do responsável antes de pagar com cartão.");
        }
        billingCpf = verifyBillingCpf(input?.billingCpf, identity.cpf_fingerprint, cpfHmacSecret);
      }

      const context = await repository.context({ buyerId, transactionId, idempotencyKey });
      if (context.existing) return { intent: publicIntent(context.intent), reused: true };
      const transaction = context.transaction;
      if (!transaction) throw new PaymentError("transaction_not_found", 404, "Transação não encontrada.");
      if (!PAYABLE_STATUSES.has(transaction.status)) throw new PaymentError("transaction_not_payable", 409, "Esta transação não pode ser paga.");
      if (!["sale", "exchange", "donation"].includes(transaction.kind)) throw new PaymentError("invalid_transaction_kind", 409, "Tipo de transação inválido.");
      if (input?.deliveryRequested || transaction.kind !== "sale") {
        throw new PaymentError("settlement_not_configured", 503, "Pagamento de troca ou frete depende de configuração dos recebedores e homologação do fornecedor.");
      }
      const amountCents = Number(transaction.amount_cents ?? 0);
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new PaymentError("invalid_amount", 409, "Valor da transação inválido.");
      const split = saleSplit(amountCents);
      const platformFeeCents = split.platformCents;
      const deliveryFeeCents = 0;
      const sellerAmountCents = split.sellerCents;
      if (sellerAmountCents < 0) throw new PaymentError("invalid_split", 409, "Divisão financeira inválida.");

      const created = await repository.createIntent({
        buyerId, transactionId, idempotencyKey, method, amountCents,
        platformFeeCents, deliveryFeeCents, sellerAmountCents,
      });
      try {
        const remote = await provider.createIntent({
          id: created.id, idempotencyKey, method, paymentMethodToken, amountCents,
          billingCpf,
          platformFeeCents, deliveryFeeCents, sellerAmountCents,
        });
        const attached = await repository.attachProvider({
          intentId: created.id, providerReference: remote.providerReference,
          status: remote.status, checkoutPayload: remote.checkout,
        });
        return { intent: publicIntent(attached), reused: false };
      } catch (error) {
        await repository.markProviderFailure({ intentId: created.id, failureCode: error.code ?? "provider_error" });
        throw error;
      }
    },
  });
}
