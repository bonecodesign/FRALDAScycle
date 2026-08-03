import { readJson } from "./body.js";
import { readSessionCookie } from "./cookies.js";
import { AuthError } from "./auth-service.js";
import { sendJson } from "./http.js";

export async function handlePayments(request, response, {
  url, headers, requestId, authService, paymentService,
}) {
  if (!paymentService || request.method !== "POST" || url.pathname !== "/v1/payments/intents") return false;
  const user = await authService.session(readSessionCookie(request.headers.cookie));
  if (!user) throw new AuthError("unauthenticated", 401, "Sessão não autenticada.");
  const result = await paymentService.createIntent(user.id, await readJson(request));
  sendJson(response, result.reused ? 200 : 201, { ...result, requestId }, headers);
  return true;
}
