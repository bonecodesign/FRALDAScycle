import { createHash, createHmac, timingSafeEqual } from "node:crypto";

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
  const webhookSecret = config.paymentWebhookSecret;
  const sdkUrl = config.paymentProviderSdkUrl;
  const sdkIntegrity = config.paymentProviderSdkIntegrity;
  return Object.freeze({
    configured: Boolean(endpoint),
    verifyWebhook({ raw, timestamp, signature, now = Date.now }) {
      if (!webhookSecret) throw new PaymentProviderError("payment_webhook_not_configured", "Webhook financeiro não configurado.");
      const seconds = Number(timestamp);
      if (!Number.isInteger(seconds) || Math.abs(Math.floor(now() / 1000) - seconds) > 300) {
        const error = new PaymentProviderError("invalid_webhook_timestamp", "Webhook financeiro inválido.");
        error.status = 401;
        throw error;
      }
      const receivedHex = String(signature ?? "").replace(/^v1=/, "");
      if (!/^[0-9a-f]{64}$/i.test(receivedHex)) {
        const error = new PaymentProviderError("invalid_webhook_signature", "Webhook financeiro inválido.");
        error.status = 401;
        throw error;
      }
      const expected = createHmac("sha256", webhookSecret).update(`${seconds}.`).update(raw).digest();
      const received = Buffer.from(receivedHex, "hex");
      if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
        const error = new PaymentProviderError("invalid_webhook_signature", "Webhook financeiro inválido.");
        error.status = 401;
        throw error;
      }
      let event;
      try { event = JSON.parse(raw.toString("utf8")); } catch {
        const error = new PaymentProviderError("invalid_webhook_payload", "Webhook financeiro inválido.");
        error.status = 400;
        throw error;
      }
      if (
        typeof event?.id !== "string" || event.id.length > 128
        || !["payment.authorized", "payment.paid", "payment.failed", "payment.refunded", "payment.disputed"].includes(event?.type)
        || typeof event?.data?.reference !== "string"
        || !Number.isInteger(event?.data?.amountCents)
        || !Number.isFinite(Date.parse(event?.createdAt))
      ) {
        const error = new PaymentProviderError("invalid_webhook_payload", "Webhook financeiro inválido.");
        error.status = 422;
        throw error;
      }
      return {
        id: event.id, type: event.type, providerReference: event.data.reference,
        amountCents: event.data.amountCents, occurredAt: new Date(event.createdAt),
        payloadHash: createHash("sha256").update(raw).digest(),
      };
    },
    async createTokenizationSession({ userId }) {
      if (!endpoint || !secret || !sdkUrl || !sdkIntegrity) {
        throw new PaymentProviderError("payment_tokenization_not_configured", "Tokenização de cartão não configurada.");
      }
      let response;
      try {
        response = await fetchImpl(new URL("/tokenization/sessions", endpoint), {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
          body: JSON.stringify({ customerReference: userId }),
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        throw new PaymentProviderError();
      }
      if (!response.ok) throw new PaymentProviderError();
      const payload = await response.json();
      if (
        typeof payload?.clientToken !== "string" || payload.clientToken.length < 16
        || !Number.isFinite(Date.parse(payload?.expiresAt))
      ) throw new PaymentProviderError("payment_provider_invalid_response", "Resposta inválida do provedor de pagamentos.");
      return {
        clientToken: payload.clientToken,
        expiresAt: payload.expiresAt,
        sdkUrl,
        sdkIntegrity,
      };
    },

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

