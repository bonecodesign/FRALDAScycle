import { createServer } from "node:http";
import { readJson } from "./body.js";
import { clearSessionCookie, readSessionCookie, sessionCookie } from "./cookies.js";
import { loadConfig } from "./config.js";
import { AuthError } from "./auth-service.js";
import { corsHeaders, requestId, sendJson } from "./http.js";
import { handleMarketplace } from "./marketplace-handler.js";
import { handleAdmin } from "./admin-handler.js";
import { createConfiguredRateLimiter, rateLimitHeaders, requestClientKey } from "./rate-limit.js";
import { createTelemetry } from "./telemetry.js";
import { handlePayments } from "./payment-handler.js";
import { handleLogistics } from "./logistics-handler.js";

function unavailable(response, headers) {
  sendJson(response, 503, {
    error: { code: "identity_unavailable", message: "Serviço de identidade indisponível." },
  }, headers);
}

export function createApiServer({
  config = loadConfig(),
  readiness = async () => ({ database: "not-configured" }),
  authService = null,
  marketplaceService = null,
  marketplaceProviders = null,
  paymentService = null,
  paymentProvider = null,
  logisticsService = null,
  adminService = null,
  rateLimiter = createConfiguredRateLimiter(config),
  telemetry = createTelemetry(config),
} = {}) {
  return createServer(async (request, response) => {
    const id = requestId(request);
    const url = new URL(request.url, "http://localhost");
    const startedAt = performance.now();
    response.once("finish", () => {
      void telemetry.record({
        type: "http.request", requestId: id, method: request.method,
        route: url.pathname, status: response.statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      });
    });
    let headers = { "x-request-id": id, ...corsHeaders(request.headers.origin, config.corsOrigins) };

    try {
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

      const rate = await rateLimiter.consume(requestClientKey(request));
      headers = { ...headers, ...rateLimitHeaders(rate) };
      if (!rate.allowed) {
        sendJson(response, 429, {
          error: { code: "rate_limited", message: "Muitas solicitações. Tente novamente em instantes." },
          requestId: id,
        }, { ...headers, "retry-after": String(rate.retryAfterSeconds) });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/invitations/accept") {
        if (!adminService) {
          sendJson(response, 503, {
            error: { code: "invitation_unavailable", message: "Serviço de convites indisponível." },
            requestId: id,
          }, headers);
          return;
        }
        const result = await adminService.acceptInvitation(await readJson(request));
        sendJson(response, 201, { ...result, requestId: id }, headers);
        return;
      }

      if (url.pathname.startsWith("/v1/auth/") && !authService) {
        unavailable(response, headers);
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/register") {
        const result = await authService.register(await readJson(request));
        sendJson(response, 201, { ...result, requestId: id }, headers);
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/login") {
        const result = await authService.login(await readJson(request), {
          userAgent: request.headers["user-agent"],
        });
        sendJson(response, 200, { user: result.user, expiresAt: result.expiresAt, requestId: id }, {
          ...headers,
          "set-cookie": sessionCookie(result.token, {
            secure: config.nodeEnv === "production",
            maxAge: config.sessionTtlSeconds,
          }),
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/auth/session") {
        const user = await authService.session(readSessionCookie(request.headers.cookie));
        if (!user) throw new AuthError("unauthenticated", 401, "Sessão não autenticada.");
        sendJson(response, 200, { user, requestId: id }, headers);
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/logout") {
        await authService.logout(readSessionCookie(request.headers.cookie));
        sendJson(response, 200, { success: true, requestId: id }, {
          ...headers,
          "set-cookie": clearSessionCookie({ secure: config.nodeEnv === "production" }),
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/verification/request") {
        const result = await authService.requestVerification(await readJson(request));
        sendJson(response, 202, { ...result, requestId: id }, headers);
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/verification/confirm") {
        const result = await authService.verifyEmail(await readJson(request));
        sendJson(response, 200, { ...result, requestId: id }, headers);
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/password/request") {
        const result = await authService.requestPasswordRecovery(await readJson(request));
        sendJson(response, 202, { ...result, requestId: id }, headers);
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/password/reset") {
        const result = await authService.resetPassword(await readJson(request));
        sendJson(response, 200, { ...result, requestId: id }, {
          ...headers,
          "set-cookie": clearSessionCookie({ secure: config.nodeEnv === "production" }),
        });
        return;
      }

      if (await handleLogistics(request, response, {
        url, headers, requestId: id, authService, logisticsService,
      })) return;

      if (await handlePayments(request, response, {
        url, headers, requestId: id, authService, paymentService, paymentProvider,
      })) return;

      if (await handleAdmin(request, response, {
        url, headers, requestId: id, authService, adminService,
      })) return;

      if (await handleMarketplace(request, response, {
        url, headers, requestId: id, marketplaceService, marketplaceProviders, authService,
      })) return;

      sendJson(response, 404, {
        error: { code: "route_not_found", message: "Rota não encontrada." },
        requestId: id,
      }, headers);
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 500;
      const code = error?.code ?? "internal_error";
      const message = status >= 500
        ? "Não foi possível concluir a solicitação."
        : error.message;
      sendJson(response, status, { error: { code, message }, requestId: id }, headers);
    }
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
