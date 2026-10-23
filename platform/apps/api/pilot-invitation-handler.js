import { readJson } from "./body.js";
import { authenticatedUser } from "./session.js";
import { sendJson } from "./http.js";

export async function handlePilotInvitations(request, response, {
  url, headers, requestId, authService, pilotInvitationService,
}) {
  if (!pilotInvitationService) return false;
  if (url.pathname === "/v1/admin/pilot-invitations" && request.method === "GET") {
    const actor = await authenticatedUser(request, authService);
    const items = await pilotInvitationService.list(actor, { limit: url.searchParams.get("limit") ?? "50" });
    sendJson(response, 200, { items, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (url.pathname === "/v1/admin/pilot-invitations" && request.method === "POST") {
    const actor = await authenticatedUser(request, authService);
    const result = await pilotInvitationService.issue(actor, await readJson(request));
    sendJson(response, result.reused ? 200 : 201, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  const revoke = url.pathname.match(/^\/v1\/admin\/pilot-invitations\/([0-9a-f-]{36})\/revoke$/i);
  if (revoke && request.method === "POST") {
    const actor = await authenticatedUser(request, authService);
    const invitation = await pilotInvitationService.revoke(actor, revoke[1], await readJson(request));
    sendJson(response, 200, { invitation, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  return false;
}
