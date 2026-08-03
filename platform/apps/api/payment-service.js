export class PaymentError extends Error {
  constructor(code, status, message) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const METHODS = new Set(["pix", "credit", "debit", "boleto"]);
const PAYABLE_STATUSES = new Set(["proposed", "reserved", "payment_pending"]);
const PLATFORM_BPS = Object.freeze({ sale: 800, exchange: 500, donation: 0 });

function fee(amount, basisPoints) {
  return Math.round(amount * basisPoints / 10_000);
}

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

export function createPaymentService(repository, provider) {
  return Object.freeze({
    async createIntent(buyerId, input) {
      const transactionId = String(input?.transactionId ?? "");
      const idempotencyKey = String(input?.idempotencyKey ?? "").trim();
      const method = String(input?.method ?? "");
      const paymentMethodToken = String(input?.paymentMethodToken ?? "").trim() || null;
      if (!/^[0-9a-f-]{36}$/i.test(transactionId)) throw new PaymentError("invalid_transaction", 422, "Transação inválida.");
      if (idempotencyKey.length < 16 || idempotencyKey.length > 128) throw new PaymentError("invalid_idempotency_key", 422, "Chave de idempotência inválida.");
      if (!METHODS.has(method)) throw new PaymentError("invalid_payment_method", 422, "Método de pagamento inválido.");
      if (input?.cardNumber || input?.cvv) throw new PaymentError("raw_card_data_forbidden", 422, "Dados brutos de cartão não são aceitos.");
      if (["credit", "debit"].includes(method) && !paymentMethodToken) {
        throw new PaymentError("payment_token_required", 422, "Tokenize o cartão antes de continuar.");
      }

      const context = await repository.context({ buyerId, transactionId, idempotencyKey });
      if (context.existing) return { intent: publicIntent(context.intent), reused: true };
      const transaction = context.transaction;
      if (!transaction) throw new PaymentError("transaction_not_found", 404, "Transação não encontrada.");
      if (!PAYABLE_STATUSES.has(transaction.status)) throw new PaymentError("transaction_not_payable", 409, "Esta transação não pode ser paga.");
      const amountCents = Number(transaction.amount_cents ?? 0);
      if (!Number.isInteger(amountCents) || amountCents < 0) throw new PaymentError("invalid_amount", 409, "Valor da transação inválido.");
      const platformFeeCents = fee(amountCents, PLATFORM_BPS[transaction.kind]);
      const deliveryFeeCents = input?.deliveryRequested ? fee(amountCents, 500) : 0;
      const sellerAmountCents = amountCents - platformFeeCents - deliveryFeeCents;
      if (sellerAmountCents < 0) throw new PaymentError("invalid_split", 409, "Divisão financeira inválida.");

      const created = await repository.createIntent({
        buyerId, transactionId, idempotencyKey, method, amountCents,
        platformFeeCents, deliveryFeeCents, sellerAmountCents,
      });
      try {
        const remote = await provider.createIntent({
          id: created.id, idempotencyKey, method, paymentMethodToken, amountCents,
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
