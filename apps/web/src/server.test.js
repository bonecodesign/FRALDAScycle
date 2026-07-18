import assert from "node:assert/strict";
import test from "node:test";

import { createWebServer } from "./server.js";

async function withServer(run) {
  const server = createWebServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("serves every public web and installable app route", async () => {
  await withServer(async (baseUrl) => {
    const routes = [
      ["/", "text/html"],
      ["/index.html", "text/html"],
      ["/app.js", "text/javascript"],
      ["/styles.css", "text/css"],
      ["/design.css", "text/css"],
      ["/map.html", "text/html"],
      ["/map.js", "text/javascript"],
      ["/map.css", "text/css"],
      ["/dashboard.html", "text/html"],
      ["/dashboard.css", "text/css"],
      ["/notifications.html", "text/html"],
      ["/notifications.js", "text/javascript"],
      ["/manifest.webmanifest", "application/manifest+json"],
      ["/service-worker.js", "text/javascript"],
      ["/icon.svg", "image/svg+xml"],
    ];

    for (const [route, contentType] of routes) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.status, 200, route);
      assert.match(response.headers.get("content-type"), new RegExp(contentType.replace("+", "\\+")));
      assert.ok((await response.arrayBuffer()).byteLength > 0, route);
    }
  });
});

test("returns not found for unknown routes and unsupported methods", async () => {
  await withServer(async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/missing`)).status, 404);
    assert.equal((await fetch(baseUrl, { method: "POST" })).status, 404);
  });
});
