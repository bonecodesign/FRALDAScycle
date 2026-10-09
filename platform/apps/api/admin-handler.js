import { readJson } from "./body.js";
import { authenticatedUser } from "./session.js";
import { AuthError } from "./auth-service.js";
import { requireScope } from "./authorization.js";
import { sendCsv, sendJson } from "./http.js";

export async function handleAdmin(request, response, {
  url, headers, requestId, authService, adminService, realtimeService, operationalControlService, marketplaceProviders,
}) {
  if (!url.pathname.startsWith("/v1/admin/")) return false;
  const user = await authenticatedUser(request, authService, { optionalService: true });

  if (request.method === "GET" && url.pathname === "/v1/admin/operational-control") {
    requireScope(user, "admin:operations:write");
    if (!operationalControlService) throw new AuthError("operational_control_unavailable", 503, "Controle operacional indisponível.");
    const result = await operationalControlService.status();
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if (request.method === "PUT" && url.pathname === "/v1/admin/operational-control") {
    requireScope(user, "admin:operations:write");
    if (!operationalControlService) throw new AuthError("operational_control_unavailable", 503, "Controle operacional indisponível.");
    const result = await operationalControlService.change(user, await readJson(request));
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if (!adminService) return false;

  const listingReview = url.pathname.match(/^\/v1\/admin\/listings\/([0-9a-f-]{36})\/review$/i);
  if (listingReview && request.method === "GET") {
    requireScope(user, "admin:moderate");
    if (!marketplaceProviders) throw new AuthError("media_provider_unavailable", 503, "Mídia de revisão indisponível.");
    const detail = await adminService.listingReviewDetail(user, listingReview[1]);
    const media = await Promise.all(detail.media.map(async item => ({
      ...item, ...(await marketplaceProviders.signedProofRead(user.id, item.storage_key)), storage_key: undefined,
    })));
    sendJson(response, 200, { listing: detail.listing, media, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (listingReview && request.method === "POST") {
    requireScope(user, "admin:moderate");
    const listing = await adminService.reviewListing(user, listingReview[1], await readJson(request));
    sendJson(response, 200, { listing, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/webhook-events") {
    requireScope(user, "admin:audit:read");
    const result = await adminService.webhookSnapshot(user, Object.fromEntries(url.searchParams));
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/access-snapshot") {
    requireScope(user, "admin:users:read");
    const result = await adminService.accessSnapshot(user);
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/catalog-snapshot") {
    requireScope(user, "admin:moderate");
    const result = await adminService.catalogSnapshot(user, Object.fromEntries(url.searchParams));
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/overview-snapshot") {
    requireScope(user, "admin:operations:read");
    const result = await adminService.overviewSnapshot(user, Object.fromEntries(url.searchParams));
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/finance-snapshot") {
    requireScope(user, "admin:finance:read");
    const result = await adminService.financeSnapshot(user, Object.fromEntries(url.searchParams));
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (request.method === "GET" && url.pathname === "/v1/admin/logistics-snapshot") {
    requireScope(user, "admin:deliveries:validate");
    const result = await adminService.logisticsSnapshot(user, Object.fromEntries(url.searchParams));
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/events/stream") {
    requireScope(user, "admin:audit:read");
    if (!realtimeService) throw new AuthError("realtime_unavailable", 503, "Monitoramento em tempo real indisponível.");
    realtimeService.open(response, {
      afterId: request.headers["last-event-id"] ?? url.searchParams.get("after") ?? 0,
      headers,
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/admin/invitations") {
    requireScope(user, "admin:users:write");
    const result = await adminService.createInvitation(user, await readJson(request));
    sendJson(response, 201, { ...result, requestId }, headers);
    return true;
  }

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
