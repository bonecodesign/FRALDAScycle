import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const port = Number(process.env.WEB_PORT ?? 3001);
const rootDirectory = fileURLToPath(new URL(".", import.meta.url));

const assets = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
};

const server = createServer(async (request, response) => {
  const asset = assets[new URL(request.url, "http://localhost").pathname];

  if (request.method !== "GET" || !asset) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const fileUrl = new URL(asset.file, `file:///${rootDirectory.replaceAll("\\", "/")}`);

  try {
    await access(fileUrl);
    response.writeHead(200, { "content-type": asset.type });
    createReadStream(fileUrl).pipe(response);
  } catch {
    response.writeHead(500);
    response.end("Unable to load application");
  }
});

server.listen(port, () => {
  console.log(`FraldaCycle web listening on port ${port}`);
});
