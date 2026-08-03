import { readJson } from "./body.js";
import { readSessionCookie } from "./cookies.js";
import { AuthError } from "./auth-service.js";
import { sendJson } from "./http.js";

async function authenticatedUser(request, authService) {
  const user = await authService.session(readSessionCookie(request.headers.cookie));
  if (!user) throw new AuthError("unauthenticated", 401, "Sessão não autenticada.");
  return user;
}

export async function handleMarketplace(request, response, {
  url, headers, requestId, marketplaceService, authService,
}) {
  if (!marketplaceService || !url.pathname.startsWith("/v1/")) return false;

  if (request.method === "GET" && url.pathname === "/v1/listings") {
    const items = await marketplaceService.search(Object.fromEntries(url.searchParams));
    sendJson(response, 200, { items, requestId }, headers);
    return true;
  }

  const detail = url.pathname.match(/^\/v1\/listings\/([0-9a-f-]{36})$/i);
  if (request.method === "GET" && detail) {
    sendJson(response, 200, { listing: await marketplaceService.detail(detail[1]), requestId }, headers);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/listings") {
    const user = await authenticatedUser(request, authService);
    const listing = await marketplaceService.create(user.id, await readJson(request));
    sendJson(response, 201, { listing, requestId }, headers);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/favorites") {
    const user = await authenticatedUser(request, authService);
    sendJson(response, 200, { items: await marketplaceService.favorites(user.id), requestId }, headers);
    return true;
  }

  const favorite = url.pathname.match(/^\/v1\/favorites\/([0-9a-f-]{36})$/i);
  if (favorite && ["POST", "DELETE"].includes(request.method)) {
    const user = await authenticatedUser(request, authService);
    const result = request.method === "POST"
      ? await marketplaceService.addFavorite(user.id, favorite[1])
      : await marketplaceService.removeFavorite(user.id, favorite[1]);
    sendJson(response, 200, { ...result, requestId }, headers);
    return true;
  }

  return false;
}
