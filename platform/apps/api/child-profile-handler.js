import { readJson } from "./body.js";
import { authenticatedUser } from "./session.js";
import { sendJson } from "./http.js";

export async function handleChildProfiles(request, response, { url, headers, requestId, authService, childProfileService }) {
  if (!childProfileService || !["/v1/account/child-profiles", "/v1/account/child-profile-notices"].some(prefix => url.pathname.startsWith(prefix))) return false;
  const actor = await authenticatedUser(request, authService);
  if (url.pathname === "/v1/account/child-profile-notices" && request.method === "GET") {
    sendJson(response, 200, { items: await childProfileService.notices(actor), requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (url.pathname === "/v1/account/child-profiles" && request.method === "GET") {
    sendJson(response, 200, { items: await childProfileService.list(actor), requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (url.pathname === "/v1/account/child-profiles" && request.method === "POST") {
    const profile = await childProfileService.create(actor, await readJson(request));
    sendJson(response, 201, { profile, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  const match = url.pathname.match(/^\/v1\/account\/child-profiles\/([0-9a-f-]{36})$/i);
  if (match && request.method === "PUT") {
    const profile = await childProfileService.update(actor, match[1], await readJson(request));
    sendJson(response, 200, { profile, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (match && request.method === "DELETE") {
    const result = await childProfileService.remove(actor, match[1], await readJson(request));
    sendJson(response, 200, { ...result, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  return false;
}
