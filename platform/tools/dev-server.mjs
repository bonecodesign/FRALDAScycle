import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const [surface = "site", portValue = "4101"] = process.argv.slice(2);
if (!["site", "app", "admin"].includes(surface)) throw new TypeError("surface must be site, app, or admin");
const platformRoot = resolve(import.meta.dirname, "..");
const appRoot = resolve(platformRoot, "apps", surface);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

createServer(async (request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const candidate = requestPath === "/" ? resolve(appRoot, "index.html") : resolve(platformRoot, requestPath.slice(1));
  if (!(candidate === appRoot || candidate.startsWith(appRoot + sep) || candidate.startsWith(resolve(platformRoot, "packages") + sep))) {
    response.writeHead(404).end("Not found"); return;
  }
  try {
    if (!(await stat(candidate)).isFile()) throw new Error("not a file");
    response.writeHead(200, { "content-type": types[extname(candidate)] ?? "application/octet-stream" });
    createReadStream(candidate).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(Number(portValue), "127.0.0.1", () => console.log(`FraldaCycle ${surface}: http://127.0.0.1:${portValue}`));
