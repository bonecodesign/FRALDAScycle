import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = 4173;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep) && target !== path.join(root, "index.html")) {
    response.writeHead(403).end("Acesso negado");
    return;
  }
  fs.readFile(target, (error, content) => {
    if (error) {
      response.writeHead(404).end("Arquivo não encontrado");
      return;
    }
    response.writeHead(200, {
      "Content-Type": types[path.extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(content);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`FraldaCycle disponível em http://127.0.0.1:${port}/#/site/home`);
  console.log("Mantenha esta janela aberta durante a apresentação.");
});
