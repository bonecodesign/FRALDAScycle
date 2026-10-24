import { readJson } from "./body.js";
import { authenticatedUser } from "./session.js";
import { sendJson } from "./http.js";

export async function handleManufacturerCatalog(request, response, {
  url, headers, requestId, authService, manufacturerCatalogService,
}) {
  if (!url.pathname.startsWith("/v1/admin/manufacturer-catalog")) return false;
  if (!manufacturerCatalogService) return false;
  const actor = await authenticatedUser(request, authService);

  if (request.method === "GET" && url.pathname === "/v1/admin/manufacturer-catalog/batches") {
    const items = await manufacturerCatalogService.listBatches(actor);
    sendJson(response, 200, { items, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/v1/admin/manufacturer-catalog/imports") {
    const batch = await manufacturerCatalogService.importBatch(actor, await readJson(request, { limit: 5_500_000 }));
    sendJson(response, 201, { batch, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  const review = url.pathname.match(/^\/v1\/admin\/manufacturer-catalog\/batches\/([0-9a-f-]{36})\/reviews$/i);
  if (review && request.method === "POST") {
    const batch = await manufacturerCatalogService.reviewBatch(actor, review[1], await readJson(request));
    sendJson(response, 200, { batch, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  return false;
}
