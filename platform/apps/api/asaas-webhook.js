import { timingSafeEqual } from "node:crypto";

// Asaas uses the asaas-access-token header, not the generic timestamped HMAC
// accepted by /v1/payments/webhooks. Keep native events isolated until their
// financial status and amount have been reconciled against the Asaas API.
export function parseAsaasWebhook({ raw, accessToken }, expectedToken) {
  if (!expectedToken || typeof accessToken !== "string") throw new Error("Asaas webhook authentication failed");
  const actual = Buffer.from(accessToken);
  const expected = Buffer.from(expectedToken);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Asaas webhook authentication failed");
  }
  let payload;
  try { payload = JSON.parse(raw.toString("utf8")); }
  catch { throw new Error("Invalid Asaas webhook payload"); }
  if (typeof payload?.id !== "string" || !payload.id || typeof payload?.event !== "string"
    || typeof payload?.payment?.id !== "string" || !payload.payment.id) {
    throw new Error("Invalid Asaas webhook payload");
  }
  return Object.freeze({ id: payload.id, event: payload.event, paymentId: payload.payment.id });
}

const EVENT_CANDIDATES = Object.freeze({
  PAYMENT_CONFIRMED: "payment_confirmation_candidate",
  PAYMENT_RECEIVED: "payment_receipt_candidate",
  PAYMENT_OVERDUE: "payment_overdue_candidate",
  PAYMENT_REFUNDED: "payment_refund_candidate",
  PAYMENT_PARTIALLY_REFUNDED: "payment_refund_candidate",
  PAYMENT_CHARGEBACK_REQUESTED: "payment_chargeback_candidate",
  PAYMENT_CHARGEBACK_DISPUTE: "payment_chargeback_candidate",
});

// A classificação nunca é uma transição financeira. O chamador deve consultar
// a cobrança no provedor e reconciliar referência, valor e estado esperado.
export function classifyAsaasWebhook(event) {
  if (!event || typeof event.id !== "string" || typeof event.paymentId !== "string"
    || typeof event.event !== "string") throw new Error("Invalid Asaas webhook event");
  return Object.freeze({
    eventId: event.id,
    paymentId: event.paymentId,
    candidate: EVENT_CANDIDATES[event.event] ?? "unsupported_event",
    requiresReconciliation: true,
    financialTransitionAllowed: false,
  });
}
