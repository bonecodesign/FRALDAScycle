import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const [surface = "site", portValue = "4101"] = process.argv.slice(2);
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
  if (surface === "app" && ["/app/onboarding", "/app/login", "/app/register", "/app/recovery", "/app/verify", "/app/home", "/app/search", "/app/favorites", "/app/chat", "/app/safety", "/app/proposal", "/app/proposal-received", "/app/negotiation-evidence", "/app/reservation", "/app/reservation-rules", "/app/reservation-cancel", "/app/reservation-cancelled", "/app/reservation-expired", "/app/payment", "/app/payment-success", "/app/wallet", "/app/wallet-cards", "/app/refund", "/app/dispute"].includes(pathname)) {
    return resolve(appRoot, `${pathname.split("/").at(-1)}.html`);
  }
  if (surface === "app" && /^\/app\/publish-[1-8]$/.test(pathname)) {
    return resolve(appRoot, `${pathname.split("/").at(-1)}.html`);
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
    response.writeHead(200, { "content-type": types[extname(candidate)] ?? "application/octet-stream" });
    createReadStream(candidate).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(Number(portValue), "127.0.0.1", () =>
  console.log(`FraldaCycle ${surface}: http://127.0.0.1:${portValue}`),
);
