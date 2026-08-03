import { readJson } from "./body.js";
import { readSessionCookie } from "./cookies.js";
import { AuthError } from "./auth-service.js";
import { requireScope } from "./authorization.js";
import { sendJson } from "./http.js";

async function authenticatedUser(request, authService) {
  const user = await authService?.session(readSessionCookie(request.headers.cookie));
  if (!user) throw new AuthError("unauthenticated", 401, "Sessão não autenticada.");
  return user;
}

export async function handleAdmin(request, response, {
  url, headers, requestId, authService, adminService,
}) {
  if (!url.pathname.startsWith("/v1/admin/")) return false;
  if (!adminService) return false;
  const user = await authenticatedUser(request, authService);

  if (request.method === "GET" && url.pathname === "/v1/admin/audit-events") {
    requireScope(user, "admin:audit:read");
    const items = await adminService.auditEvents(Object.fromEntries(url.searchParams));
    sendJson(response, 200, { items, requestId }, headers);
    return true;
  }

  const roleChange = url.pathname.match(/^\/v1\/admin\/users\/([0-9a-f-]{36})\/role$/i);
  if (request.method === "PATCH" && roleChange) {
    requireScope(user, "admin:roles:write");
    const changedUser = await adminService.changeUserRole(user, roleChange[1], await readJson(request));
    sendJson(response, 200, { user: changedUser, requestId }, headers);
    return true;
  }

  return false;
}
