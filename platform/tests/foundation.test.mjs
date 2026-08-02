import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolve } from "node:path";
import { SURFACES, routeFor } from "../packages/contracts/routes.js";

const root = resolve(import.meta.dirname, "..");

test("keeps independent contracts for Site, App and Admin", () => {
  assert.deepEqual(Object.keys(SURFACES), ["site", "app", "admin"]);
  assert.equal(routeFor("site", "search"), "/site/search");
  assert.equal(routeFor("app", "payment"), "/app/payment");
  assert.equal(routeFor("admin", "security"), "/admin/security");
});

test("creates accessible shells without replacing the approved prototype", async () => {
  for (const surface of Object.keys(SURFACES)) {
    const html = await readFile(resolve(root, "apps", surface, "index.html"), "utf8");
    assert.match(html, /<html lang="pt-BR">/);
    assert.match(html, /<meta name="viewport"/);
    assert.match(html, /<main data-surface="/);
    assert.match(html, /protótipo preservado na raiz/i);
  }
});

test("uses the exact approved foundation tokens", async () => {
  const css = await readFile(resolve(root, "packages/ui/tokens.css"), "utf8");
  assert.match(css, /--fc-color-primary: #16a34a/);
  assert.match(css, /--fc-color-primary-dark: #0f7a3a/);
  assert.match(css, /--fc-color-secondary: #2563eb/);
  assert.match(css, /--fc-color-support: #7c3aed/);
  assert.match(css, /--fc-motion-standard: 250ms/);
});


test("transfers the approved Site Home without changing its product language", async () => {
  const html = await readFile(resolve(root, "apps/site/index.html"), "utf8");
  assert.match(html, /data-source-route="#\/site\/home"/);
  assert.match(html, /Pequenas escolhas,/);
  assert.match(html, /grandes mudanças\./);
  assert.match(html, /Compre, troque ou doe fraldas fechadas/);
  assert.match(html, /Uma jornada simples e segura/);
  assert.match(html, /Anúncios em destaque/);
  assert.match(html, /5\.080 kg/);
  assert.match(html, /Dados apresentados nesta experiência: simulados/);
});

test("uses approved source assets through an explicit read-only adapter", async () => {
  const html = await readFile(resolve(root, "apps/site/index.html"), "utf8");
  const adapter = await readFile(resolve(root, "packages/ui/source-adapter.css"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/site/source.json"), "utf8"));

  assert.match(html, /\/source\/assets\/approved\/logo-approved\.png/);
  assert.match(html, /\/source\/assets\/approved\/pampers-approved\.png/);
  assert.match(adapter, /@import url\("\/source\/styles\.css"\)/);
  assert.match(adapter, /@import url\("\/source\/fidelity\.css"\)/);
  assert.match(server, /approvedSourceFiles/);
  assert.match(server, /sourceAssetsRoot/);
  assert.deepEqual(provenance.modifiedSourceFiles, []);
  assert.equal(provenance.source.function, "siteHome");
});
