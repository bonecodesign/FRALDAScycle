export class PaymentProviderError extends Error {
  constructor(code = "payment_provider_unavailable", message = "Provedor de pagamentos indisponível.") {
    super(message);
    this.code = code;
    this.status = 503;
  }
}

export function createPaymentProvider(config, { fetchImpl = fetch } = {}) {
  const endpoint = config.paymentProviderUrl ? new URL(config.paymentProviderUrl) : null;
  const secret = config.paymentProviderSecret;
  return Object.freeze({
    configured: Boolean(endpoint),
    async createIntent(intent) {
      if (!endpoint || !secret) throw new PaymentProviderError("payment_provider_not_configured", "Provedor de pagamentos não configurado.");
      let response;
      try {
        response = await fetchImpl(new URL("/intents", endpoint), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${secret}`,
            "idempotency-key": intent.idempotencyKey,
          },
          body: JSON.stringify({
            reference: intent.id,
            amountCents: intent.amountCents,
            currency: "BRL",
            method: intent.method,
            paymentMethodToken: intent.paymentMethodToken,
            split: {
              platformCents: intent.platformFeeCents,
              deliveryCents: intent.deliveryFeeCents,
              sellerCents: intent.sellerAmountCents,
            },
          }),
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        throw new PaymentProviderError();
      }
      if (!response.ok) throw new PaymentProviderError();
      const payload = await response.json();
      if (typeof payload?.reference !== "string" || !["pending", "authorized", "paid"].includes(payload?.status)) {
        throw new PaymentProviderError("payment_provider_invalid_response", "Resposta inválida do provedor de pagamentos.");
      }
      return {
        providerReference: payload.reference,
        status: payload.status,
        checkout: {
          qrCode: typeof payload.qrCode === "string" ? payload.qrCode : null,
          boletoUrl: typeof payload.boletoUrl === "string" ? payload.boletoUrl : null,
          clientSecret: typeof payload.clientSecret === "string" ? payload.clientSecret : null,
        },
      };
    },
  });
}
