import { readJson } from "./body.js";
import { sendJson } from "./http.js";
import { authenticatedUser } from "./session.js";

export async function handleResponsibleProfileChange(request, response, {
  url, headers, requestId, authService, responsibleProfileChangeService,
}) {
  if (!responsibleProfileChangeService) return false;
  const actions = new Map([
    ["/v1/account/responsible-profile/change/request", "request"],
    ["/v1/account/responsible-profile/change/confirm", "confirm"],
  ]);
  const action = request.method === "POST" ? actions.get(url.pathname) : null;
  if (!action) return false;
  const actor = await authenticatedUser(request, authService);
  const result = await responsibleProfileChangeService[action](actor, await readJson(request));
  sendJson(response, action === "request" ? 202 : 200, { ...result, requestId }, {
    ...headers, "cache-control": "no-store", pragma: "no-cache",
  });
  return true;
}
