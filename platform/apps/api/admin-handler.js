import { readJson } from "./body.js";
import { readSessionCookie } from "./cookies.js";
import { AuthError } from "./auth-service.js";
import { requireScope } from "./authorization.js";
import { sendCsv, sendJson } from "./http.js";

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

  if (request.method === "GET" && url.pathname === "/v1/admin/sessions") {
    requireScope(user, "admin:security:write");
    const items = await adminService.sessions(user);
    sendJson(response, 200, { items, requestId }, headers);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/admin/sessions/revoke-others") {
    requireScope(user, "admin:security:write");
    const result = await adminService.revokeOtherSessions(user);
    sendJson(response, 200, { ...result, requestId }, headers);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/users") {
    requireScope(user, "admin:users:read");
    const items = await adminService.users(Object.fromEntries(url.searchParams));
    sendJson(response, 200, { items, requestId }, headers);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/audit-events.csv") {
    requireScope(user, "admin:audit:read");
    sendCsv(response, "fraldacycle-auditoria.csv", await adminService.auditCsv(), headers);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/audit-events") {
    requireScope(user, "admin:audit:read");
    const items = await adminService.auditEvents(Object.fromEntries(url.searchParams));
    sendJson(response, 200, { items, requestId }, headers);
    return true;
  }

  const statusChange = url.pathname.match(/^\/v1\/admin\/users\/([0-9a-f-]{36})\/status$/i);
  if (request.method === "PATCH" && statusChange) {
    requireScope(user, "admin:users:write");
    const changedUser = await adminService.setUserStatus(user, statusChange[1], await readJson(request));
    sendJson(response, 200, { user: changedUser, requestId }, headers);
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
