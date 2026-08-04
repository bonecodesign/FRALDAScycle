import assert from "node:assert/strict";
import test from "node:test";
import { smokeDeployment } from "../tools/smoke-deployment.mjs";

const env = {
  API_URL: "https://api.fraldacycle.test",
  SITE_URL: "https://www.fraldacycle.test",
  APP_URL: "https://app.fraldacycle.test",
  ADMIN_URL: "https://admin.fraldacycle.test",
};

test("deployment smoke validates API and every approved surface", async () => {
  const visited = [];
  const report = await smokeDeployment(env, {
    async fetchImpl(url) {
      visited.push(url.pathname);
      if (url.pathname === "/health") return Response.json({ status: "ok" });
      if (url.pathname === "/ready") return Response.json({ status: "ready" });
      return new Response("<!doctype html><title>FraldaCycle</title>", {
        headers: { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff" },
      });
    },
  });
  assert.equal(report.ready, true);
  assert.deepEqual(visited, ["/health", "/ready", "/site/home", "/app/home", "/admin/dashboard"]);
});

test("deployment smoke rejects insecure targets and missing headers", async () => {
  await assert.rejects(smokeDeployment({ ...env, SITE_URL: "http://site.invalid" }), /must use HTTPS/);
  await assert.rejects(smokeDeployment(env, {
    async fetchImpl(url) {
      if (url.pathname === "/health") return Response.json({ status: "ok" });
      if (url.pathname === "/ready") return Response.json({ status: "ready" });
      return new Response("html", { headers: { "content-type": "text/html" } });
    },
  }), /missing security headers/);
});
