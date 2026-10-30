import { readJson } from "./body.js";
import { authenticatedUser } from "./session.js";
import { AuthError } from "./auth-service.js";
import { requireAccessLevel, requireScope } from "./authorization.js";
import { sendCsv, sendJson } from "./http.js";

export async function handleAdmin(request, response, {
  url, headers, requestId, authService, adminService, realtimeService, operationalControlService, operationalIncidentService, incidentRoleService, staffAccessService, paymentService, marketplaceProviders,
}) {
  if (!url.pathname.startsWith("/v1/admin/")) return false;
  const user = await authenticatedUser(request, authService, { optionalService: true });

  if (request.method === "GET" && url.pathname === "/v1/admin/operational-control") {
    requireAccessLevel(user, 2);
    if (!operationalControlService) throw new AuthError("operational_control_unavailable", 503, "Controle operacional indisponível.");
    const result = await operationalControlService.status();
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if (request.method === "PUT" && url.pathname === "/v1/admin/operational-control") {
    if (!operationalControlService) throw new AuthError("operational_control_unavailable", 503, "Controle operacional indisponível.");
    const input=await readJson(request);
    requireAccessLevel(user,["payments","refunds","payouts"].includes(input?.domain)?3:4);
    const result = await operationalControlService.change(user, input);
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if(request.method==='GET'&&url.pathname==='/v1/admin/operational-resume-requests'){
    if(!operationalControlService)throw new AuthError('operational_control_unavailable',503,'Controle operacional indisponível.');const result=await operationalControlService.resumeRequests(user);sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }
  if(request.method==='POST'&&url.pathname==='/v1/admin/operational-resume-requests'){
    if(!operationalControlService)throw new AuthError('operational_control_unavailable',503,'Controle operacional indisponível.');const result=await operationalControlService.proposeResume(user,await readJson(request));sendJson(response,201,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }
  const resumeDecision=url.pathname.match(/^\/v1\/admin\/operational-resume-requests\/([0-9a-f-]{36})\/decision$/i);
  if(request.method==='POST'&&resumeDecision){if(!operationalControlService)throw new AuthError('operational_control_unavailable',503,'Controle operacional indisponível.');const result=await operationalControlService.decideResume(user,resumeDecision[1],await readJson(request));sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}

  if (request.method === "GET" && url.pathname === "/v1/admin/incidents") {
    requireAccessLevel(user, 2);
    if (!operationalIncidentService) throw new AuthError("incident_console_unavailable", 503, "Console de incidentes indisponível.");
    const result=await operationalIncidentService.list(Object.fromEntries(url.searchParams));
    sendJson(response,200,{...result,requestId},{...headers,"cache-control":"no-store"});return true;
  }
  if (request.method === "POST" && url.pathname === "/v1/admin/incidents") {
    if (!operationalIncidentService) throw new AuthError("incident_console_unavailable", 503, "Console de incidentes indisponível.");
    const input=await readJson(request);requireAccessLevel(user,["payments","refunds","payouts"].includes(input?.domain)?3:2);
    const result=await operationalIncidentService.create(user,input);
    sendJson(response,result.reused?200:201,{...result,requestId},{...headers,"cache-control":"no-store"});return true;
  }
  const incident=url.pathname.match(/^\/v1\/admin\/incidents\/([0-9a-f-]{36})$/i);
  if (incident && request.method === "GET") {
    requireAccessLevel(user, 2);
    if (!operationalIncidentService) throw new AuthError("incident_console_unavailable", 503, "Console de incidentes indisponível.");
    const result=await operationalIncidentService.detail(incident[1]);
    sendJson(response,200,{...result,requestId},{...headers,"cache-control":"no-store"});return true;
  }
  if (incident && request.method === "PATCH") {
    requireAccessLevel(user, 2);
    if (!operationalIncidentService) throw new AuthError("incident_console_unavailable", 503, "Console de incidentes indisponível.");
    const result=await operationalIncidentService.change(user,incident[1],await readJson(request));
    sendJson(response,200,{...result,requestId},{...headers,"cache-control":"no-store"});return true;
  }
  if(request.method==='GET'&&url.pathname==='/v1/admin/incident-roles'){if(!incidentRoleService)throw new AuthError('incident_roles_unavailable',503,'Nomeações de incidentes indisponíveis.');const result=await incidentRoleService.list(user);sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  if(request.method==='POST'&&url.pathname==='/v1/admin/incident-roles'){if(!incidentRoleService)throw new AuthError('incident_roles_unavailable',503,'Nomeações de incidentes indisponíveis.');const result=await incidentRoleService.appoint(user,await readJson(request));sendJson(response,201,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  const incidentRoleDecision=url.pathname.match(/^\/v1\/admin\/incident-roles\/([0-9a-f-]{36})\/decision$/i);if(request.method==='POST'&&incidentRoleDecision){if(!incidentRoleService)throw new AuthError('incident_roles_unavailable',503,'Nomeações de incidentes indisponíveis.');const result=await incidentRoleService.decide(user,incidentRoleDecision[1],await readJson(request));sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}

  if (request.method==='GET'&&url.pathname==='/v1/admin/access-level-changes') {
    if(!staffAccessService)throw new AuthError('staff_access_unavailable',503,'Gestão de níveis indisponível.');
    const result=await staffAccessService.list(user);sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }
  if (request.method==='POST'&&url.pathname==='/v1/admin/access-level-changes') {
    if(!staffAccessService)throw new AuthError('staff_access_unavailable',503,'Gestão de níveis indisponível.');
    const result=await staffAccessService.propose(user,await readJson(request));sendJson(response,201,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }
  const accessDecision=url.pathname.match(/^\/v1\/admin\/access-level-changes\/([0-9a-f-]{36})\/decision$/i);
  if(request.method==='POST'&&accessDecision){
    if(!staffAccessService)throw new AuthError('staff_access_unavailable',503,'Gestão de níveis indisponível.');
    const result=await staffAccessService.decide(user,accessDecision[1],await readJson(request));sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }

  const supportedRefund=url.pathname.match(/^\/v1\/admin\/supported-cancellations\/([0-9a-f-]{36})$/i);
  if(request.method==='GET'&&url.pathname==='/v1/admin/supported-cancellations'){
    if(!paymentService?.supportedRefundQueue)throw new AuthError('refund_execution_unavailable',503,'Acompanhamento financeiro indisponível.');
    const result=await paymentService.supportedRefundQueue(user);sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }
  const supportedRefundHistory=url.pathname.match(/^\/v1\/admin\/supported-cancellations\/([0-9a-f-]{36})\/history$/i);
  if(request.method==='GET'&&supportedRefundHistory){if(!paymentService?.supportedRefundHistory)throw new AuthError('refund_execution_unavailable',503,'Histórico financeiro indisponível.');const result=await paymentService.supportedRefundHistory(user,supportedRefundHistory[1]);sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  const supportedRefundReview=url.pathname.match(/^\/v1\/admin\/supported-cancellations\/([0-9a-f-]{36})\/reviews$/i);
  if(request.method==='POST'&&supportedRefundReview){if(!paymentService?.reviewBlockedSupportedRefund)throw new AuthError('refund_execution_unavailable',503,'Tratamento financeiro indisponível.');const result=await paymentService.reviewBlockedSupportedRefund(user,supportedRefundReview[1],await readJson(request));sendJson(response,201,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  if(request.method==='GET'&&supportedRefund){
    if(!paymentService?.supportedRefundStatus)throw new AuthError('refund_execution_unavailable',503,'Execução financeira indisponível.');
    const result=await paymentService.supportedRefundStatus(user,supportedRefund[1]);
    sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }

  const refundExecution=url.pathname.match(/^\/v1\/admin\/supported-cancellations\/([0-9a-f-]{36})\/execute$/i);
  if(request.method==='POST'&&refundExecution){
    if(!paymentService?.executeSupportedRefund)throw new AuthError('refund_execution_unavailable',503,'Execução financeira indisponível.');
    const result=await paymentService.executeSupportedRefund(user,refundExecution[1],await readJson(request));
    sendJson(response,result.reused?200:202,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
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
    const reviewContext = adminService.issueReviewContext(user, detail, media);
    sendJson(response, 200, { listing: detail.listing, media, reviewContext, requestId }, { ...headers, "cache-control": "no-store" });
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
