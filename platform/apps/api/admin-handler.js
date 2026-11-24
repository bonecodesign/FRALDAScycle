import { readJson } from "./body.js";
import { authenticatedUser } from "./session.js";
import { AuthError } from "./auth-service.js";
import { requireAccessLevel, requireAdminSector, requireSectorScope } from "./authorization.js";
import { sendCsv, sendJson } from "./http.js";
import {loadLaunchPreparationSnapshot} from './launch-preparation-service.js';

const routeSectors=Object.freeze([
  ['/v1/admin/exchange-retention',['finance']],
  ['/v1/admin/freight-settlement-plans',['finance']],
  ['/v1/admin/supported-cancellations',['finance']],
  ['/v1/admin/courier-wallet-blocked',['finance']],
  ['/v1/admin/courier-wallet-resolutions',['finance']],
  ['/v1/admin/courier-wallet-support',['support']],
  ['/v1/admin/family-responsibility-disputes',['support','legal_privacy']],
  ['/v1/admin/child-data-emergency-access',['legal_privacy','security']],
  ['/v1/admin/authority-requests',['legal_privacy']],
  ['/v1/admin/content-retention-holds',['legal_privacy','moderation']],
  ['/v1/admin/operational-control',['operations','finance']],
  ['/v1/admin/operational-resume-requests',['operations','finance']],
  ['/v1/admin/incidents',['operations','finance','security','legal_privacy']],
  ['/v1/admin/incident-roles',['operations','security']],
  ['/v1/admin/support-duty',['support','operations']],
  ['/v1/admin/access-level-changes',['operations']],
  ['/v1/admin/staff-sector-changes',['operations']],
]);
export function requireAdminRouteSector(user,pathname){const match=routeSectors.find(([prefix])=>pathname.startsWith(prefix));if(match)requireAdminSector(user,match[1]);return user;}

// A moderator must never receive a signed preview of raw/unprocessed media.
// Verify the COMPLETE current batch before issuing any temporary read link.
// This is technical proof only; a human must still inspect every image.
export async function verifiedListingReviewMedia(provider, detail, reviewerId) {
  if (typeof provider?.verifyListingMedia !== 'function' ||
      typeof provider?.signedProofRead !== 'function') {
    throw new AuthError('media_provider_unavailable', 503, 'Mídia de revisão indisponível.');
  }
  if (detail?.listing?.status !== 'review') {
    throw new AuthError('listing_review_conflict', 409, 'O anúncio não está mais aguardando revisão.');
  }
  const ownerId = detail.listing.seller_id;
  const rows = detail.media;
  if (typeof ownerId !== 'string' || !ownerId ||
      !Array.isArray(rows) || rows.length < 1 || rows.length > 8 ||
      rows.some(row => !row || typeof row.storage_key !== 'string' ||
        !row.storage_key.startsWith(`listings/${ownerId}/`) ||
        row.storage_key.includes('..')) ||
      new Set(rows.map(row => row.storage_key)).size !== rows.length) {
    throw new AuthError('listing_media_required', 409, 'As fotos do anúncio precisam ser conferidas novamente.');
  }
  const keys = rows.map(row => row.storage_key);
  const proof = await provider.verifyListingMedia(ownerId, keys);
  if (proof?.verified !== true || proof.count !== keys.length) {
    throw new AuthError('media_not_ready', 409, 'Nem todas as fotos estão confirmadas para revisão.');
  }
  return Promise.all(rows.map(async row => ({
    ...row,
    ...(await provider.signedProofRead(reviewerId, row.storage_key)),
    storage_key: undefined,
  })));
}

export async function handleAdmin(request, response, {
  url, headers, requestId, authService, adminService, realtimeService, operationalControlService, operationalIncidentService, incidentRoleService, supportDutyService, staffAccessService, paymentService, freightSettlementService, marketplaceProviders, exchangeRetentionStatusService, exchangeRetentionRequestService, childProfileResponsibilityService, childDataEmergencyAccessService, authorityRequestService, userContentRetentionService, courierWalletService,
}) {
  if (!url.pathname.startsWith("/v1/admin/")) return false;
  const user = await authenticatedUser(request, authService, { optionalService: true });
  requireAdminRouteSector(user,url.pathname);

  if(request.method==='GET'&&url.pathname==='/v1/admin/launch-preparation'){
    requireAccessLevel(user,1);
    try{
      const result=await loadLaunchPreparationSnapshot();
      sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});
    }catch{
      throw new AuthError('launch_preparation_unavailable',503,'Prontidão de lançamento indisponível.');
    }
    return true;
  }

  if(request.method==='GET'&&url.pathname==='/v1/admin/courier-wallet-blocked'){
    if(!courierWalletService)throw new AuthError('courier_wallet_unavailable',503,'Fila de saques indisponível.');
    const result=await courierWalletService.blocked(user);sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }
  const blockedWalletProposal=url.pathname.match(/^\/v1\/admin\/courier-wallet-blocked\/([0-9a-f-]{36})\/proposals$/i);
  if(request.method==='POST'&&blockedWalletProposal){if(!courierWalletService)throw new AuthError('courier_wallet_unavailable',503,'Fila de saques indisponível.');const result=await courierWalletService.proposeBlocked(user,blockedWalletProposal[1],await readJson(request));sendJson(response,201,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  const blockedWalletReview=url.pathname.match(/^\/v1\/admin\/courier-wallet-resolutions\/([0-9a-f-]{36})\/level4-review$/i);
  if(request.method==='POST'&&blockedWalletReview){if(!courierWalletService)throw new AuthError('courier_wallet_unavailable',503,'Fila de saques indisponível.');const result=await courierWalletService.reviewBlocked(user,blockedWalletReview[1],await readJson(request));sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  const blockedWalletAuthorization=url.pathname.match(/^\/v1\/admin\/courier-wallet-resolutions\/([0-9a-f-]{36})\/level5-authorization$/i);
  if(request.method==='POST'&&blockedWalletAuthorization){if(!courierWalletService)throw new AuthError('courier_wallet_unavailable',503,'Fila de saques indisponível.');const result=await courierWalletService.authorizeBlocked(user,blockedWalletAuthorization[1],await readJson(request));sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  if(request.method==='GET'&&url.pathname==='/v1/admin/courier-wallet-support'){if(!courierWalletService)throw new AuthError('courier_wallet_unavailable',503,'Pendências de saque indisponíveis.');const result=await courierWalletService.supportBlocked(user);sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  const walletSupportUpdate=url.pathname.match(/^\/v1\/admin\/courier-wallet-support\/([0-9a-f-]{36})\/updates$/i);
  if(request.method==='POST'&&walletSupportUpdate){if(!courierWalletService)throw new AuthError('courier_wallet_unavailable',503,'Pendências de saque indisponíveis.');const result=await courierWalletService.updateSupportBlocked(user,walletSupportUpdate[1],await readJson(request));sendJson(response,201,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}

  if (request.method === 'POST' && url.pathname === '/v1/admin/freight-settlement-plans') {
    if (!freightSettlementService) throw new AuthError('freight_settlement_unavailable',503,'Preparação financeira indisponível.');
    const result = await freightSettlementService.prepare(user, await readJson(request));
    sendJson(response,result.reused?200:201,{...result,requestId},{...headers,'cache-control':'no-store'});
    return true;
  }
  const exchangeDifferenceAccounting = url.pathname.match(/^\/v1\/admin\/freight-settlement-plans\/exchanges\/([0-9a-f-]{36})\/difference-accounting$/i);
  if (request.method === 'GET' && exchangeDifferenceAccounting) {
    if (!freightSettlementService) throw new AuthError('freight_settlement_unavailable',503,'Conferência financeira indisponível.');
    const result=await freightSettlementService.exchangeDifferenceAccounting(user,exchangeDifferenceAccounting[1]);
    sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});
    return true;
  }
  const exchangeFreight = url.pathname.match(/^\/v1\/admin\/freight-settlement-plans\/exchanges\/([0-9a-f-]{36})\/legs$/i);
  if (request.method === 'GET' && exchangeFreight) {
    if (!freightSettlementService) throw new AuthError('freight_settlement_unavailable',503,'Análise financeira indisponível.');
    const result=await freightSettlementService.exchangeFreightSummary(user,exchangeFreight[1]);
    sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});
    return true;
  }
  const freightSupervision = url.pathname.match(/^\/v1\/admin\/freight-settlement-plans\/([0-9a-f-]{36})\/supervision$/i);
  if (freightSupervision && (request.method === 'GET' || request.method === 'POST')) {
    if (!freightSettlementService) throw new AuthError('freight_settlement_unavailable',503,'Supervisão financeira indisponível.');
    const result=request.method === 'GET'
      ? await freightSettlementService.supervision(user,freightSupervision[1])
      : await freightSettlementService.linkSupervision(user,freightSupervision[1],await readJson(request));
    sendJson(response,request.method==='GET'?200:201,{...result,requestId},{...headers,'cache-control':'no-store'});
    return true;
  }
  const freightPlan = url.pathname.match(/^\/v1\/admin\/freight-settlement-plans\/([0-9a-f-]{36})\/reconciliation(?:\/check)?$/i);
  if (request.method === 'POST' && freightPlan
    && url.pathname.endsWith('/reconciliation/check')) {
    if (!freightSettlementService) throw new AuthError('freight_settlement_unavailable',503,'Conciliação financeira indisponível.');
    const result = await freightSettlementService.checkAndRecord(user,freightPlan[1],await readJson(request));
    sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});
    return true;
  }
  if (request.method === 'GET' && freightPlan) {
    if (!freightSettlementService) throw new AuthError('freight_settlement_unavailable',503,'Preparação financeira indisponível.');
    const result = await freightSettlementService.reconcileLocal(user,freightPlan[1]);
    sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});
    return true;
  }

  if(request.method==='GET'&&url.pathname==='/v1/admin/exchange-retention-status'){requireAccessLevel(user,2);if(!exchangeRetentionStatusService)throw new AuthError('retention_status_unavailable',503,'Situação da retenção indisponível.');const result=await exchangeRetentionStatusService.snapshot();sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  if(request.method==='GET'&&url.pathname==='/v1/admin/exchange-retention-requests'){if(!exchangeRetentionRequestService)throw new AuthError('retention_requests_unavailable',503,'Solicitações de retenção indisponíveis.');const result=await exchangeRetentionRequestService.list(user);sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  if(request.method==='POST'&&url.pathname==='/v1/admin/exchange-retention-requests'){if(!exchangeRetentionRequestService)throw new AuthError('retention_requests_unavailable',503,'Solicitações de retenção indisponíveis.');const result=await exchangeRetentionRequestService.request(user,await readJson(request));sendJson(response,201,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  const retentionReview=url.pathname.match(/^\/v1\/admin\/exchange-retention-requests\/([0-9a-f-]{36})\/review$/i);if(request.method==='POST'&&retentionReview){if(!exchangeRetentionRequestService)throw new AuthError('retention_requests_unavailable',503,'Solicitações de retenção indisponíveis.');const result=await exchangeRetentionRequestService.review(user,retentionReview[1],await readJson(request));sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  if(request.method==='GET'&&url.pathname==='/v1/admin/family-responsibility-disputes'){if(!childProfileResponsibilityService)throw new AuthError('family_responsibility_unavailable',503,'Análise familiar indisponível.');const result=await childProfileResponsibilityService.list(user);sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  if(request.method==='POST'&&url.pathname==='/v1/admin/family-responsibility-disputes'){if(!childProfileResponsibilityService)throw new AuthError('family_responsibility_unavailable',503,'Análise familiar indisponível.');const result=await childProfileResponsibilityService.open(user,await readJson(request));sendJson(response,201,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  const familyVerify=url.pathname.match(/^\/v1\/admin\/family-responsibility-disputes\/([0-9a-f-]{36})\/verify$/i);if(request.method==='POST'&&familyVerify){if(!childProfileResponsibilityService)throw new AuthError('family_responsibility_unavailable',503,'Análise familiar indisponível.');const result=await childProfileResponsibilityService.verify(user,familyVerify[1],await readJson(request));sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  const familyDecision=url.pathname.match(/^\/v1\/admin\/family-responsibility-disputes\/([0-9a-f-]{36})\/decision$/i);if(request.method==='POST'&&familyDecision){if(!childProfileResponsibilityService)throw new AuthError('family_responsibility_unavailable',503,'Análise familiar indisponível.');const result=await childProfileResponsibilityService.decide(user,familyDecision[1],await readJson(request));sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  if(request.method==='GET'&&url.pathname==='/v1/admin/child-data-emergency-access'){if(!childDataEmergencyAccessService)throw new AuthError('child_data_emergency_access_unavailable',503,'Acesso emergencial indisponível.');const result=await childDataEmergencyAccessService.list(user);sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  if(request.method==='POST'&&url.pathname==='/v1/admin/child-data-emergency-access'){if(!childDataEmergencyAccessService)throw new AuthError('child_data_emergency_access_unavailable',503,'Acesso emergencial indisponível.');const result=await childDataEmergencyAccessService.request(user,await readJson(request));sendJson(response,201,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  const childEmergencyApproval=url.pathname.match(/^\/v1\/admin\/child-data-emergency-access\/([0-9a-f-]{36})\/approval$/i);if(request.method==='POST'&&childEmergencyApproval){if(!childDataEmergencyAccessService)throw new AuthError('child_data_emergency_access_unavailable',503,'Acesso emergencial indisponível.');const result=await childDataEmergencyAccessService.approve(user,childEmergencyApproval[1],await readJson(request));sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  const childEmergencyRead=url.pathname.match(/^\/v1\/admin\/child-data-emergency-access\/grants\/([0-9a-f-]{36})$/i);if(request.method==='GET'&&childEmergencyRead){if(!childDataEmergencyAccessService)throw new AuthError('child_data_emergency_access_unavailable',503,'Acesso emergencial indisponível.');const result=await childDataEmergencyAccessService.read(user,childEmergencyRead[1]);sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store','content-security-policy':"default-src 'none'; frame-ancestors 'none'"});return true;}
  if(request.method==='GET'&&url.pathname==='/v1/admin/authority-requests'){if(!authorityRequestService)throw new AuthError('authority_requests_unavailable',503,'Solicitações de autoridades indisponíveis.');const result=await authorityRequestService.list(user);sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  if(request.method==='POST'&&url.pathname==='/v1/admin/authority-requests'){if(!authorityRequestService)throw new AuthError('authority_requests_unavailable',503,'Solicitações de autoridades indisponíveis.');const result=await authorityRequestService.protocol(user,await readJson(request));sendJson(response,201,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  const authorityValidation=url.pathname.match(/^\/v1\/admin\/authority-requests\/([0-9a-f-]{36})\/validation$/i);if(request.method==='POST'&&authorityValidation){if(!authorityRequestService)throw new AuthError('authority_requests_unavailable',503,'Solicitações de autoridades indisponíveis.');const result=await authorityRequestService.validate(user,authorityValidation[1],await readJson(request));sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  const authorityDecision=url.pathname.match(/^\/v1\/admin\/authority-requests\/([0-9a-f-]{36})\/decision$/i);if(request.method==='POST'&&authorityDecision){if(!authorityRequestService)throw new AuthError('authority_requests_unavailable',503,'Solicitações de autoridades indisponíveis.');const result=await authorityRequestService.decide(user,authorityDecision[1],await readJson(request));sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  if(request.method==='GET'&&url.pathname==='/v1/admin/content-retention-holds'){if(!userContentRetentionService)throw new AuthError('content_retention_unavailable',503,'Retenção de conteúdo indisponível.');const result=await userContentRetentionService.list(user);sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  if(request.method==='POST'&&url.pathname==='/v1/admin/content-retention-holds'){if(!userContentRetentionService)throw new AuthError('content_retention_unavailable',503,'Retenção de conteúdo indisponível.');const result=await userContentRetentionService.request(user,await readJson(request));sendJson(response,201,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
  const contentHoldDecision=url.pathname.match(/^\/v1\/admin\/content-retention-holds\/([0-9a-f-]{36})\/decision$/i);if(request.method==='POST'&&contentHoldDecision){if(!userContentRetentionService)throw new AuthError('content_retention_unavailable',503,'Retenção de conteúdo indisponível.');const result=await userContentRetentionService.decide(user,contentHoldDecision[1],await readJson(request));sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}

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
  const resumeReview=url.pathname.match(/^\/v1\/admin\/operational-resume-requests\/([0-9a-f-]{36})\/review$/i);
  if(request.method==='POST'&&resumeReview){if(!operationalControlService)throw new AuthError('operational_control_unavailable',503,'Controle operacional indisponível.');const result=await operationalControlService.reviewResume(user,resumeReview[1],await readJson(request));sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
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
    const input=await readJson(request);requireAccessLevel(user,["payments","refunds","payouts","privacy"].includes(input?.domain)?3:2);
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
  if(url.pathname==='/v1/admin/support-duty'&&request.method==='GET'){
    if(!supportDutyService)throw new AuthError('support_duty_unavailable',503,'Governança de suporte indisponível.');
    const result=await supportDutyService.list(user);
    sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }
  if(url.pathname==='/v1/admin/support-duty/proposals'&&request.method==='POST'){
    if(!supportDutyService)throw new AuthError('support_duty_unavailable',503,'Governança de suporte indisponível.');
    const result=await supportDutyService.propose(user,await readJson(request));
    sendJson(response,201,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }
  const dutyReview=url.pathname.match(/^\/v1\/admin\/support-duty\/proposals\/([0-9a-f-]{36})\/review$/i);
  if(dutyReview&&request.method==='POST'){
    if(!supportDutyService)throw new AuthError('support_duty_unavailable',503,'Governança de suporte indisponível.');
    const result=await supportDutyService.review(user,dutyReview[1],await readJson(request));
    sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }
  const dutyDecision=url.pathname.match(/^\/v1\/admin\/support-duty\/proposals\/([0-9a-f-]{36})\/decision$/i);
  if(dutyDecision&&request.method==='POST'){
    if(!supportDutyService)throw new AuthError('support_duty_unavailable',503,'Governança de suporte indisponível.');
    const result=await supportDutyService.decide(user,dutyDecision[1],await readJson(request));
    sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }
  const dutyResponse=url.pathname.match(/^\/v1\/admin\/support-duty\/assignments\/([0-9a-f-]{36})\/response$/i);
  if(dutyResponse&&request.method==='POST'){
    if(!supportDutyService)throw new AuthError('support_duty_unavailable',503,'Governança de suporte indisponível.');
    const result=await supportDutyService.respond(user,dutyResponse[1],await readJson(request));
    sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }
  const dutyRevoke=url.pathname.match(/^\/v1\/admin\/support-duty\/assignments\/([0-9a-f-]{36})\/revoke$/i);
  if(dutyRevoke&&request.method==='POST'){
    if(!supportDutyService)throw new AuthError('support_duty_unavailable',503,'Governança de suporte indisponível.');
    const result=await supportDutyService.revoke(user,dutyRevoke[1],await readJson(request));
    sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
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

  if(request.method==='GET'&&url.pathname==='/v1/admin/staff-sector-changes'){
    if(!staffAccessService)throw new AuthError('staff_access_unavailable',503,'Gestão de setores indisponível.');
    const result=await staffAccessService.listSectors(user);sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }
  if(request.method==='POST'&&url.pathname==='/v1/admin/staff-sector-changes'){
    if(!staffAccessService)throw new AuthError('staff_access_unavailable',503,'Gestão de setores indisponível.');
    const result=await staffAccessService.proposeSector(user,await readJson(request));sendJson(response,201,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }
  const sectorDecision=url.pathname.match(/^\/v1\/admin\/staff-sector-changes\/([0-9a-f-]{36})\/decision$/i);
  if(request.method==='POST'&&sectorDecision){
    if(!staffAccessService)throw new AuthError('staff_access_unavailable',503,'Gestão de setores indisponível.');
    const result=await staffAccessService.decideSector(user,sectorDecision[1],await readJson(request));sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
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
    requireSectorScope(user, "admin:moderate");
    const detail = await adminService.listingReviewDetail(user, listingReview[1]);
    const media = await verifiedListingReviewMedia(marketplaceProviders, detail, user.id);
    const reviewContext = adminService.issueReviewContext(user, detail, media);
    sendJson(response, 200, { listing: detail.listing, media, reviewContext, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (listingReview && request.method === "POST") {
    requireSectorScope(user, "admin:moderate");
    const listing = await adminService.reviewListing(user, listingReview[1], await readJson(request));
    sendJson(response, 200, { listing, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/webhook-events") {
    requireSectorScope(user, "admin:audit:read");
    const result = await adminService.webhookSnapshot(user, Object.fromEntries(url.searchParams));
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/access-snapshot") {
    requireSectorScope(user, "admin:users:read");
    const result = await adminService.accessSnapshot(user);
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/catalog-snapshot") {
    requireSectorScope(user, "admin:moderate");
    const result = await adminService.catalogSnapshot(user, Object.fromEntries(url.searchParams));
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/overview-snapshot") {
    requireSectorScope(user, "admin:operations:read");
    const result = await adminService.overviewSnapshot(user, Object.fromEntries(url.searchParams));
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/finance-snapshot") {
    requireSectorScope(user, "admin:finance:read");
    const result = await adminService.financeSnapshot(user, Object.fromEntries(url.searchParams));
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (request.method === "GET" && url.pathname === "/v1/admin/logistics-snapshot") {
    requireSectorScope(user, "admin:deliveries:validate");
    const result = await adminService.logisticsSnapshot(user, Object.fromEntries(url.searchParams));
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/events/stream") {
    requireSectorScope(user, "admin:audit:read");
    if (!realtimeService) throw new AuthError("realtime_unavailable", 503, "Monitoramento em tempo real indisponível.");
    realtimeService.open(response, {
      afterId: request.headers["last-event-id"] ?? url.searchParams.get("after") ?? 0,
      headers,
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/admin/invitations") {
    requireSectorScope(user, "admin:users:write");
    const result = await adminService.createInvitation(user, await readJson(request));
    sendJson(response, 201, { ...result, requestId }, headers);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/sessions") {
    requireSectorScope(user, "admin:security:write");
    const items = await adminService.sessions(user);
    sendJson(response, 200, { items, requestId }, headers);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/admin/sessions/revoke-others") {
    requireSectorScope(user, "admin:security:write");
    const result = await adminService.revokeOtherSessions(user);
    sendJson(response, 200, { ...result, requestId }, headers);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/users") {
    requireSectorScope(user, "admin:users:read");
    const items = await adminService.users(Object.fromEntries(url.searchParams));
    sendJson(response, 200, { items, requestId }, headers);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/audit-events.csv") {
    requireSectorScope(user, "admin:audit:read");
    sendCsv(response, "fraldacycle-auditoria.csv", await adminService.auditCsv(), headers);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/audit-events") {
    requireSectorScope(user, "admin:audit:read");
    const items = await adminService.auditEvents(Object.fromEntries(url.searchParams));
    sendJson(response, 200, { items, requestId }, headers);
    return true;
  }

  const statusChange = url.pathname.match(/^\/v1\/admin\/users\/([0-9a-f-]{36})\/status$/i);
  if (request.method === "PATCH" && statusChange) {
    requireSectorScope(user, "admin:users:write");
    const changedUser = await adminService.setUserStatus(user, statusChange[1], await readJson(request));
    sendJson(response, 200, { user: changedUser, requestId }, headers);
    return true;
  }

  const roleChange = url.pathname.match(/^\/v1\/admin\/users\/([0-9a-f-]{36})\/role$/i);
  if (request.method === "PATCH" && roleChange) {
    requireSectorScope(user, "admin:roles:write");
    const changedUser = await adminService.changeUserRole(user, roleChange[1], await readJson(request));
    sendJson(response, 200, { user: changedUser, requestId }, headers);
    return true;
  }

  return false;
}
