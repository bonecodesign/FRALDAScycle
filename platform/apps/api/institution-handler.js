import { readJson } from "./body.js";
import { readSessionCookie } from "./cookies.js";
import { AuthError } from "./auth-service.js";
import { requireScope } from "./authorization.js";
import { sendJson } from "./http.js";

async function authenticated(request, authService) {
  const user = await authService?.session(readSessionCookie(request.headers.cookie));
  if (!user) throw new AuthError("unauthenticated", 401, "Sessão não autenticada.");
  return user;
}

export async function handleInstitutions(request, response, {
  url, headers, requestId, authService, institutionService,
}) {
  if (!institutionService) return false;
  if (request.method === "GET" && url.pathname === "/v1/institutions") {
    const items = await institutionService.active(Object.fromEntries(url.searchParams));
    sendJson(response, 200, { items, requestId }, headers);
    return true;
  }
  if (request.method === "POST" && url.pathname === "/v1/institutions/applications") {
    const user = await authenticated(request, authService);
    const institution = await institutionService.submit(user.id, await readJson(request));
    sendJson(response, 201, { institution, requestId }, headers);
    return true;
  }
  if (request.method === "GET" && url.pathname === "/v1/admin/institutions") {
    const user = await authenticated(request, authService);
    requireScope(user, "admin:institutions:read");
    const items = await institutionService.applications(Object.fromEntries(url.searchParams));
    sendJson(response, 200, { items, requestId }, headers);
    return true;
  }
  const status = url.pathname.match(/^\/v1\/admin\/institutions\/([0-9a-f-]{36})\/status$/i);
  if (request.method === "PATCH" && status) {
    const user = await authenticated(request, authService);
    requireScope(user, "admin:institutions:write");
    const institution = await institutionService.changeStatus(user.id, status[1], await readJson(request));
    sendJson(response, 200, { institution, requestId }, headers);
    return true;
  }
  return false;
}
