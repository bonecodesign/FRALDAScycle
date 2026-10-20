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
