import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const [surface = process.env.SURFACE ?? "site", portValue = process.env.PORT ?? "4101"] = process.argv.slice(2);
const host = process.env.SURFACE_HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const production = process.env.NODE_ENV === "production";
if (!["site", "app", "admin"].includes(surface)) throw new TypeError("surface must be site, app, or admin");

const platformRoot = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(platformRoot, "..");
const appRoot = resolve(platformRoot, "apps", surface);
const packageRoot = resolve(platformRoot, "packages");
const sourceAssetsRoot = resolve(sourceRoot, "assets");
const approvedSourceFiles = new Set([
  resolve(sourceRoot, "styles.css"),
  resolve(sourceRoot, "map-safety.css"),
  resolve(sourceRoot, "fidelity.css"),
]);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function resolveRequest(pathname) {
  if (pathname === "/" || pathname === "/site/home") return resolve(appRoot, "index.html");
  if (surface === "app" && (pathname === "/app/splash" || pathname === "/app")) return resolve(appRoot, "index.html");
  if (surface === "admin" && (pathname === "/admin/dashboard" || pathname === "/admin")) return resolve(appRoot, "index.html");
  if (surface === "admin" && ["/admin/users", "/admin/roles", "/admin/ads", "/admin/operations", "/admin/finance", "/admin/logistics", "/admin/reports", "/admin/data", "/admin/forecast", "/admin/alerts", "/admin/infrastructure", "/admin/security", "/admin/moderation", "/admin/audit", "/admin/settings", "/admin/partnerships", "/admin/innovation", "/admin/launch"].includes(pathname)) {
    return resolve(appRoot, `${pathname.split("/").at(-1)}.html`);
  }
  if (surface === "app" && ["/app/onboarding", "/app/login", "/app/register", "/app/recovery", "/app/verify", "/app/reset-password", "/app/home", "/app/search", "/app/favorites", "/app/chat", "/app/safety", "/app/proposal", "/app/proposal-received", "/app/negotiation-evidence", "/app/reservation", "/app/reservation-rules", "/app/reservation-cancel", "/app/reservation-cancelled", "/app/reservation-expired", "/app/payment", "/app/payment-success", "/app/wallet", "/app/wallet-cards", "/app/refund", "/app/dispute", "/app/delivery-options", "/app/delivery", "/app/delivery-reschedule", "/app/delivery-proof", "/app/delivery-confirm", "/app/delivery-rate", "/app/auth-error", "/app/auth-locked", "/app/auth-offline", "/app/notifications", "/app/notification-settings", "/app/profile", "/app/profile-ads", "/app/profile-history", "/app/profile-reviews", "/app/addresses", "/app/settings", "/app/my-impact", "/app/help", "/app/state-offline", "/app/state-permission", "/app/state-removed"].includes(pathname)) {
    return resolve(appRoot, `${pathname.split("/").at(-1)}.html`);
  }
  if (surface === "app" && /^\/app\/publish-[1-8]$/.test(pathname)) {
    return resolve(appRoot, `${pathname.split("/").at(-1)}.html`);
  }
  if (surface === "app" && ["/courier/home", "/courier/job", "/courier/route", "/courier/proof", "/courier/history"].includes(pathname)) {
    return resolve(appRoot, `courier-${pathname.split("/").at(-1)}.html`);
  }
  if (surface === "site" && pathname === "/site/search") return resolve(appRoot, "search.html");
  if (surface === "site" && ["/site/detail", "/site/seller", "/site/favorites", "/site/publish", "/site/impact", "/site/help", "/site/login", "/site/component-states", "/site/advanced-components", "/site/design-tokens", "/site/responsive-lab", "/site/accessibility-lab", "/site/motion-lab"].includes(pathname)) {
    return resolve(appRoot, `${pathname.split("/").at(-1)}.html`);
  }

  if (pathname.startsWith("/source/")) {
    const candidate = resolve(sourceRoot, pathname.slice("/source/".length));
    const allowed =
      approvedSourceFiles.has(candidate) ||
      candidate.startsWith(sourceAssetsRoot + sep);
    return allowed ? candidate : null;
  }

  const candidate = resolve(platformRoot, pathname.slice(1));
  const allowed =
    candidate.startsWith(appRoot + sep) ||
    candidate.startsWith(packageRoot + sep);
  return allowed ? candidate : null;
}

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const candidate = resolveRequest(pathname);

  if (!candidate) {
    response.writeHead(404).end("Not found");
    return;
  }

  try {
    if (!(await stat(candidate)).isFile()) throw new Error("not a file");
    response.writeHead(200, {
      "content-type": types[extname(candidate)] ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
      "content-security-policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      "cache-control": extname(candidate) === ".html" ? "no-cache" : (production ? "public, max-age=3600" : "no-cache"),
    });
    createReadStream(candidate).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(Number(portValue), host, () =>
  console.log(`FraldaCycle ${surface}: http://${host}:${portValue}`),
);
