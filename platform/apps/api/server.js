import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { corsHeaders, requestId, sendJson } from "./http.js";

export function createApiServer({ config = loadConfig(), readiness = async () => ({ database: "not-configured" }) } = {}) {
  return createServer(async (request, response) => {
    const id = requestId(request);
    const url = new URL(request.url, "http://localhost");
    const headers = { "x-request-id": id, ...corsHeaders(request.headers.origin, config.corsOrigins) };

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        ...headers,
        "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "content-type,authorization,x-request-id",
      });
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "fraldacycle-api", requestId: id }, headers);
      return;
    }

    if (request.method === "GET" && url.pathname === "/ready") {
      try {
        const dependencies = await readiness();
        sendJson(response, 200, { status: "ready", dependencies, requestId: id }, headers);
      } catch {
        sendJson(response, 503, { status: "unavailable", requestId: id }, headers);
      }
      return;
    }

    sendJson(response, 404, {
      error: { code: "route_not_found", message: "Rota não encontrada." },
      requestId: id,
    }, headers);
  });
}

export function startApi(config = loadConfig()) {
  const server = createApiServer({ config });
  server.listen(config.port, config.host, () => {
    console.log(`FraldaCycle API: http://${config.host}:${config.port}`);
  });
  return server;
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) startApi();
