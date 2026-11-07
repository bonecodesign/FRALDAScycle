import { requireAccessLevel, requireSectorScope } from "./authorization.js";
import { ServiceError } from "./service-error.js";
import { freightSettlementReconciliation } from "../../packages/contracts/freight-settlement.js";
import { exchangeFreightLegReadiness } from "../../packages/contracts/exchange-freight-readiness.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function finance(actor) {
  requireSectorScope(actor, "admin:finance:read");
  requireAccessLevel(actor, 3);
}
function validId(id) {
  if (!UUID.test(String(id ?? ""))) {
    throw new ServiceError("invalid_freight_settlement_id", 422, "Identificador de preparação financeira inválido.");
  }
}
function publicPlan(plan) {
  return Object.freeze({
    id: plan.id,
    deliveryQuoteId: plan.delivery_quote_id,
    transactionId: plan.transaction_id,
    shipmentId: plan.shipment_id,
    provider: plan.provider,
    providerAmountCents: plan.provider_amount_cents,
    platformFeeCents: plan.platform_fee_cents,
    customerTotalCents: plan.customer_total_cents,
    currency: plan.currency,
    preparedAt: plan.prepared_at,
    executionAllowed: false,
    externalChargeCreated: false,
  });
}
export function createFreightSettlementService(repository) {
  return Object.freeze({
    async exchangeFreightSummary(actor,transactionId) {
      finance(actor);
      validId(transactionId);
      const context=await repository.exchangeLegs(transactionId);
      if(!context)throw new ServiceError("exchange_transaction_not_found",404,
        "Troca não encontrada para análise financeira.");
      return exchangeFreightLegReadiness({
        transactionId,buyerId:context.buyerId,sellerId:context.sellerId,
        rows:context.rows,
      });
    },
    async prepare(actor, input) {
      finance(actor);
      if (!input || typeof input !== "object" || Array.isArray(input)
        || Object.keys(input).some(key => !["quoteId","confirmed"].includes(key))
        || input.confirmed !== true) {
        throw new ServiceError("freight_plan_confirmation_required", 422, "Confirme a preparação local sem cobrança.");
      }
      validId(input.quoteId);
      const result = await repository.prepare({ actorId: actor.id, quoteId: input.quoteId });
      return { plan: publicPlan(result.plan), reused: result.reused };
    },
    async supervision(actor,planId) {
      finance(actor);
      validId(planId);
      const result=await repository.supervision(planId);
      return { supervision:result };
    },
    async linkSupervision(actor,planId,input) {
      finance(actor);
      validId(planId);
      if(!input||typeof input!=="object"||Array.isArray(input)
        ||Object.keys(input).some(key=>!["incidentId","confirmed"].includes(key))
        ||input.confirmed!==true) {
        throw new ServiceError("freight_supervision_confirmation_required",422,
          "Confirme o vínculo para supervisão humana.");
      }
      validId(input.incidentId);
      return repository.linkSupervision({actorId:actor.id,planId,incidentId:input.incidentId});
    },
    async checkAndRecord(actor, planId, input) {
      finance(actor);
      validId(planId);
      if (!input || typeof input !== "object" || Array.isArray(input)
        || Object.keys(input).some(key => key !== "confirmed") || input.confirmed !== true) {
        throw new ServiceError("freight_reconciliation_confirmation_required",422,
          "Confirme a verificação local sem execução financeira.");
      }
      const reviewed = await this.reconcileLocal(actor,planId);
      const codes = reviewed.reconciliation.blockers.filter(
        code => code !== "external_reconciliation_not_homologated",
      );
      const incidents = await repository.recordIncidents({actorId:actor.id,planId,codes});
      return { ...reviewed, incidents };
    },
    async reconcileLocal(actor, planId) {
      finance(actor);
      validId(planId);
      const row = await repository.context(planId);
      if (!row) throw new ServiceError("freight_plan_not_found", 404, "Preparação financeira não encontrada.");
      const result = freightSettlementReconciliation({
        plan: row,
        quote: {
          id: row.current_quote_id, status: row.quote_status, confirmed_by: row.quote_confirmed_by,
          provider: row.quote_provider, base_freight_cents: row.quote_base_freight_cents,
          platform_fee_cents: row.quote_platform_fee_cents, customer_total_cents: row.quote_total_cents,
        },
        transaction: {
          id: row.current_transaction_id, amount_cents: row.product_amount_cents, kind: row.kind,
        },
        payment: row.payment_id ? {
          status: row.payment_status, provider_reference: row.payment_provider_reference,
          amount_cents: row.payment_amount_cents, platform_fee_cents: row.payment_platform_fee_cents,
          delivery_fee_cents: row.payment_delivery_fee_cents, seller_amount_cents: row.payment_seller_amount_cents,
        } : null,
        paidCount: row.paid_count,
        financialCasePending: row.financial_case_pending,
      });
      return { plan: publicPlan(row), reconciliation: result };
    },
  });
}
