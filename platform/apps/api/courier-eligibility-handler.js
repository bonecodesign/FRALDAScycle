import { readJson } from "./body.js";
import { authenticatedUser } from "./session.js";
import { sendJson } from "./http.js";

export async function handleCourierEligibility(request, response, {
  url, headers, requestId, authService, courierEligibilityService,
}) {
  if (!courierEligibilityService) return false;
  if (request.method === "POST" && url.pathname === "/v1/admin/courier-clearance/maintenance/schedule") {
    const actor = await authenticatedUser(request, authService);
    const scheduled = await courierEligibilityService.scheduleMaintenance(actor);
    sendJson(response, 200, { scheduled, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (request.method === "GET" && url.pathname === "/v1/admin/courier-clearance/review-queue") {
    const actor = await authenticatedUser(request, authService);
    const items = await courierEligibilityService.reviewQueue(actor, { limit: url.searchParams.get("limit") ?? "50" });
    sendJson(response, 200, { items, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (request.method === "GET" && url.pathname === "/v1/admin/courier-clearance/support-queue") {
    const actor = await authenticatedUser(request, authService);
    const items = await courierEligibilityService.supportQueue(actor, { limit: url.searchParams.get("limit") ?? "50" });
    sendJson(response, 200, { items, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (request.method === "GET" && url.pathname === "/v1/courier/eligibility") {
    const actor = await authenticatedUser(request, authService);
    const eligibility = await courierEligibilityService.status(actor);
    sendJson(response, 200, { eligibility, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/v1/courier/eligibility/support-release") {
    const actor = await authenticatedUser(request, authService);
    const supportRequest = await courierEligibilityService.requestSupportRelease(actor, await readJson(request));
    sendJson(response, supportRequest.reused ? 200 : 201, { supportRequest, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  const adminStatus = url.pathname.match(/^\/v1\/admin\/couriers\/([0-9a-f-]{36})\/eligibility$/i);
  if (request.method === "GET" && adminStatus) {
    const actor = await authenticatedUser(request, authService);
    const eligibility = await courierEligibilityService.status(actor, adminStatus[1]);
    sendJson(response, 200, { eligibility, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  const review = url.pathname.match(/^\/v1\/admin\/courier-clearance\/reviews\/([0-9a-f-]{36})\/decision$/i);
  if (request.method === "POST" && review) {
    const actor = await authenticatedUser(request, authService);
    const decision = await courierEligibilityService.decideReview(actor, review[1], await readJson(request));
    sendJson(response, 200, { decision, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  const release = url.pathname.match(/^\/v1\/admin\/courier-clearance\/suspensions\/([0-9a-f-]{36})\/release$/i);
  if (request.method === "POST" && release) {
    const actor = await authenticatedUser(request, authService);
    const suspension = await courierEligibilityService.releaseSuspension(actor, release[1], await readJson(request));
    sendJson(response, 200, { suspension, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/v1/admin/courier-clearance/support/close-expired") {
    const actor = await authenticatedUser(request, authService);
    const result = await courierEligibilityService.closeExpiredSupportRequests(actor);
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  return false;
}
