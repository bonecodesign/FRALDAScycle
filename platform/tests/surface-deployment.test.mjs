import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";

function startSurface(surface, port) {
  const child = spawn(process.execPath, ["tools/dev-server.mjs", surface, String(port)], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, NODE_ENV: "production", SURFACE_HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("surface server did not start")), 5_000);
    child.once("error", reject);
    child.stdout.once("data", () => {
      clearTimeout(timeout);
      resolve(child);
    });
  });
}

test("production surface serves approved routes with security headers", async (context) => {
  const port = 45_000 + Math.floor(Math.random() * 1_000);
  const child = await startSurface("site", port);
  context.after(() => child.kill());

  const response = await fetch(`http://127.0.0.1:${port}/site/home`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(response.headers.get("cache-control"), "no-cache");
  assert.match(await response.text(), /FraldaCycle/i);
});
