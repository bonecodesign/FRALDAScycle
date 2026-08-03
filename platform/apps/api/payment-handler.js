import { readJson, readSignedJson } from "./body.js";
import { readSessionCookie } from "./cookies.js";
import { AuthError } from "./auth-service.js";
import { sendJson } from "./http.js";

export async function handlePayments(request, response, {
  url, headers, requestId, authService, paymentService, paymentProvider,
}) {
  if (request.method === "POST" && url.pathname === "/v1/payments/webhooks") {
    if (!paymentService || !paymentProvider) return false;
    const { raw } = await readSignedJson(request, { limit: 65_536 });
    const event = paymentProvider.verifyWebhook({
      raw,
      timestamp: request.headers["x-payment-timestamp"],
      signature: request.headers["x-payment-signature"],
    });
    const result = await paymentService.processWebhook(event);
    sendJson(response, 200, { ...result, requestId }, headers);
    return true;
  }
  const paymentCase = url.pathname.match(/^\/v1\/payments\/([0-9a-f-]{36})\/(refunds|disputes)$/i);
  if (
    !paymentService || request.method !== "POST"
    || (!paymentCase && !["/v1/payments/tokenization-sessions", "/v1/payments/intents"].includes(url.pathname))
  ) return false;
  const user = await authService.session(readSessionCookie(request.headers.cookie));
  if (!user) throw new AuthError("unauthenticated", 401, "Sessão não autenticada.");
  if (paymentCase) {
    const kind = paymentCase[2] === "refunds" ? "refund" : "dispute";
    const result = await paymentService.createCase(user.id, paymentCase[1], kind, await readJson(request));
    sendJson(response, result.reused ? 200 : 201, { ...result, requestId }, headers);
    return true;
  }
  if (url.pathname === "/v1/payments/tokenization-sessions") {
    const tokenization = await paymentService.tokenizationSession(user.id);
    sendJson(response, 201, { tokenization, requestId }, headers);
    return true;
  }
  if (url.pathname !== "/v1/payments/intents") return false;
  const result = await paymentService.createIntent(user.id, await readJson(request));
  sendJson(response, result.reused ? 200 : 201, { ...result, requestId }, headers);
  return true;
}
