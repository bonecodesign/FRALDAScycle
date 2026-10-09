import { readJson } from "./body.js";
import { authenticatedUser } from "./session.js";
import { sendJson } from "./http.js";

export async function handleAdultDeclaration(request, response, { url, headers, requestId, authService, adultDeclarationService }) {
  if (!adultDeclarationService || url.pathname !== "/v1/account/adult-declaration" || !["GET", "PUT"].includes(request.method)) return false;
  const actor = await authenticatedUser(request, authService);
  const result = request.method === "GET"
    ? await adultDeclarationService.status(actor)
    : await adultDeclarationService.declare(actor, await readJson(request));
  sendJson(response, 200, { declaration: result, requestId }, { ...headers, "cache-control": "no-store" });
  return true;
}
