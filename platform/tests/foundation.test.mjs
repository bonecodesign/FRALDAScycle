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
    assert.match(html, /<html lang="pt-BR"(?:\s[^>]*)?>/);
    assert.match(html, /<meta name="viewport"/);
    if (surface === "site") {
      assert.match(html, /data-source-route="#\/site\/home"/);
      assert.match(html, /Pequenas escolhas,/);
    } else {
      assert.match(html, /<main data-surface="/);
      assert.match(html, /protótipo preservado na raiz/i);
    }
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
  assert.ok(provenance.source.functions.includes("siteHome"));
});


test("transfers approved Site Search and Map as a dedicated route", async () => {
  const html = await readFile(resolve(root, "apps/site/search.html"), "utf8");
  const behavior = await readFile(resolve(root, "apps/site/search.js"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/site/source.json"), "utf8"));

  assert.match(html, /data-source-route="#\/site\/search"/);
  assert.match(html, /Encontre o que sua família precisa/);
  assert.match(html, /128 resultados/);
  assert.match(html, /Itens encontrados próximos a você/);
  assert.match(html, /4 de 128 resultados visíveis · Simulado/);
  assert.equal((html.match(/data-map-product=/g) ?? []).length, 4);
  assert.equal((html.match(/class="product-card"/g) ?? []).length, 4);
  assert.match(behavior, /querySelectorAll\("\[data-map-product\]"\)/);
  assert.match(behavior, /toLocaleLowerCase\("pt-BR"\)/);
  assert.match(server, /pathname === "\/site\/search"/);
  for (const name of ["siteHome", "siteSearch", "resultsMap", "productCards", "setupMap"]) assert.ok(provenance.source.functions.includes(name));
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});


test("transfers detail seller and favorites while documenting missing destination architecture", async () => {
  const [detail, seller, favorites, favoriteBehavior, server] = await Promise.all([
    readFile(resolve(root, "apps/site/detail.html"), "utf8"),
    readFile(resolve(root, "apps/site/seller.html"), "utf8"),
    readFile(resolve(root, "apps/site/favorites.html"), "utf8"),
    readFile(resolve(root, "apps/site/favorites.js"), "utf8"),
    readFile(resolve(root, "tools/dev-server.mjs"), "utf8"),
  ]);
  const provenance = JSON.parse(await readFile(resolve(root, "apps/site/source.json"), "utf8"));

  assert.match(detail, /Pampers Confort<br>M · 50 unidades/);
  assert.match(detail, /Pagamento protegido até a confirmação do recebimento/);
  assert.match(detail, /href="\/site\/seller"/);
  assert.match(seller, /Uma família que acredita na economia circular/);
  assert.match(seller, /Reputação na comunidade/);
  assert.match(seller, /3 anúncios/);
  assert.equal((seller.match(/class="product-card"/g) ?? []).length, 3);
  assert.match(favorites, /Seus favoritos/);
  assert.match(favorites, /Carregando seus favoritos/);
  assert.match(favoriteBehavior, /let saved = \[0, 1, 3\]/);
  assert.match(favoriteBehavior, /Lista de favoritos limpa/);
  assert.match(server, /"\/site\/detail", "\/site\/seller", "\/site\/favorites"/);
  for (const name of ["siteDetail", "siteSeller", "siteFavorites", "setupSiteFavorites"]) {
    assert.ok(provenance.source.functions.includes(name));
  }
  assert.equal(provenance.architectureAdditions[0].name, "productCard");
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});


test("transfers the approved publish impact and help experiences", async () => {
  const [publish, publishBehavior, impact, impactBehavior, help, server] = await Promise.all([
    readFile(resolve(root, "apps/site/publish.html"), "utf8"),
    readFile(resolve(root, "apps/site/publish.js"), "utf8"),
    readFile(resolve(root, "apps/site/impact.html"), "utf8"),
    readFile(resolve(root, "apps/site/impact.js"), "utf8"),
    readFile(resolve(root, "apps/site/help.html"), "utf8"),
    readFile(resolve(root, "tools/dev-server.mjs"), "utf8"),
  ]);
  const provenance = JSON.parse(await readFile(resolve(root, "apps/site/source.json"), "utf8"));

  assert.match(publish, /Etapa 1 de 8 · Tipo de negociação/);
  assert.equal((publish.match(/data-site-publish-step=/g) ?? []).length, 8);
  assert.match(publishBehavior, /Adicione pelo menos uma foto para continuar/);
  assert.match(publishBehavior, /Anúncio publicado com sucesso/);
  assert.match(publishBehavior, /\/source\/assets\/approved\/pampers-approved\.png/);
  assert.match(impact, /Resultados que transformam territórios/);
  assert.equal((impact.match(/data-impact-value=/g) ?? []).length, 6);
  assert.equal((impact.match(/data-impact-place=/g) ?? []).length, 4);
  assert.match(impactBehavior, /Metodologia, fontes e governança/);
  assert.match(impactBehavior, /toLocaleString\('pt-BR'\)/);
  assert.match(help, /Como podemos ajudar\?/);
  assert.match(help, /Compra protegida/);
  assert.match(server, /"\/site\/publish", "\/site\/impact", "\/site\/help"/);
  for (const name of ["sitePublish", "setupSitePublish", "siteImpact", "setupSiteImpact", "siteHelp"]) {
    assert.ok(provenance.source.functions.includes(name));
  }
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});
