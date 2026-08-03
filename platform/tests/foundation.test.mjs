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
    } else if (surface === "app") {
      assert.match(html, /data-source-route="#\/app\/splash"/);
      assert.match(html, /Economia circular para famílias e para o planeta/);
    } else {
      assert.match(html, /data-source-route="#\/admin\/dashboard"/);
      assert.match(html, /Painel administrativo/);
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


test("closes the complete approved Site route inventory without changing source files", async () => {
  const routes = [
    ["login", /Acesse sua conta para continuar/],
    ["component-states", /Estados completos dos componentes/],
    ["advanced-components", /Componentes avançados/],
    ["design-tokens", /Tokens e padrões visuais/],
    ["responsive-lab", /Laboratório de breakpoints/],
    ["accessibility-lab", /Auditoria WCAG 2\.1 AA/],
    ["motion-lab", /Animações e microinterações/],
  ];
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/site/source.json"), "utf8"));

  for (const [route, approvedCopy] of routes) {
    const [html, behavior] = await Promise.all([
      readFile(resolve(root, `apps/site/${route}.html`), "utf8"),
      readFile(resolve(root, `apps/site/${route}.js`), "utf8"),
    ]);
    assert.match(html, new RegExp(`data-source-route="#/site/${route}"`));
    assert.match(html, approvedCopy);
    assert.match(behavior, /import "\/apps\/site\/home\.js"/);
    assert.ok(server.includes(`"/site/${route}"`));
    assert.ok(provenance.destination.routes.includes(`/site/${route}`));
  }

  assert.deepEqual(provenance.source.files, [
    "app.js",
    "advanced-components.js",
    "design-tokens.js",
    "responsive-lab.js",
    "accessibility-lab.js",
    "motion-lab.js",
  ]);
  assert.match(await readFile(resolve(root, "apps/site/login.js"), "utf8"), /Informações validadas com sucesso/);
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});


test("transfers the complete approved App identity journey", async () => {
  const routes = [
    ["index", "splash", /Economia circular para famílias e para o planeta/],
    ["onboarding", "onboarding", /Pequenas escolhas,<br>grandes mudanças/],
    ["login", "login", /Bem-vindo\(a\)! 👋/],
    ["register", "register", /Criar sua conta/],
    ["recovery", "recovery", /Recuperar senha/],
    ["verify", "verify", /Digite o código de 6 dígitos/],
    ["home", "home", /Que bom ter você por aqui/],
  ];
  const behavior = await readFile(resolve(root, "apps/app/auth.js"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/app/source.json"), "utf8"));

  for (const [file, route, approvedCopy] of routes) {
    const html = await readFile(resolve(root, `apps/app/${file}.html`), "utf8");
    assert.match(html, new RegExp(`data-source-route="#/app/${route}"`));
    assert.match(html, approvedCopy);
    assert.ok(server.includes(`"/app/${route}"`));
    assert.ok(provenance.destination.routes.includes(`/app/${route}`));
  }

  assert.match(behavior, /contactValid/);
  assert.match(behavior, /Digite os seis números do código/);
  assert.match(behavior, /Novo código enviado com sucesso/);
  assert.match(behavior, /location\.pathname/);
  const verifyHtml = await readFile(resolve(root, "apps/app/verify.html"), "utf8");
  assert.equal((verifyHtml.match(/maxlength="1"/g) ?? []).length, 6);
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});


test("transfers App marketplace filters favorites and all eight publish steps", async () => {
  const [search, searchBehavior, favorites, favoritesBehavior, publishBehavior, server] = await Promise.all([
    readFile(resolve(root, "apps/app/search.html"), "utf8"),
    readFile(resolve(root, "apps/app/search.js"), "utf8"),
    readFile(resolve(root, "apps/app/favorites.html"), "utf8"),
    readFile(resolve(root, "apps/app/favorites.js"), "utf8"),
    readFile(resolve(root, "apps/app/publish.js"), "utf8"),
    readFile(resolve(root, "tools/dev-server.mjs"), "utf8"),
  ]);
  const provenance = JSON.parse(await readFile(resolve(root, "apps/app/source.json"), "utf8"));

  assert.match(search, /Buscar produtos/);
  assert.match(search, /Tipo de negociação/);
  assert.match(search, /Preço mínimo/);
  assert.match(searchBehavior, /Buscando itens próximos/);
  assert.match(searchBehavior, /toLocaleLowerCase\('pt-BR'\)/);
  assert.match(favorites, /Itens salvos/);
  assert.match(favorites, /Anúncios \(3\)/);
  assert.match(favoritesBehavior, /Nenhum favorito salvo/);

  for (let step = 1; step <= 8; step += 1) {
    const route = `publish-${step}`;
    const html = await readFile(resolve(root, `apps/app/${route}.html`), "utf8");
    assert.match(html, new RegExp(`data-source-route="#/app/${route}"`));
    assert.match(html, new RegExp(`Etapa ${step} de 8`));
    assert.ok(provenance.destination.routes.includes(`/app/${route}`));
  }

  assert.match(publishBehavior, /Adicione pelo menos uma foto do produto/);
  assert.match(publishBehavior, /Anúncio publicado com sucesso/);
  assert.match(server, /\/app\\\/publish-\[1-8\]/);
  for (const name of ["appSearch", "setupSearchStates", "appFavorites", "appPublish", "setupPublishValidation"]) {
    assert.ok(provenance.source.functions.includes(name));
  }
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});


test("transfers protected chat proposal evidence and reservation states", async () => {
  const routes = [
    ["chat", /Negociação protegida/],
    ["safety", /Opções da conversa/],
    ["proposal", /Nova proposta/],
    ["proposal-received", /Contraproposta recebida/],
    ["negotiation-evidence", /Evidências da negociação/],
    ["reservation", /Produto reservado/],
    ["reservation-rules", /Regras da reserva/],
    ["reservation-cancel", /Cancelar reserva\?/],
    ["reservation-cancelled", /Reserva cancelada/],
    ["reservation-expired", /Reserva expirada/],
  ];
  const behavior = await readFile(resolve(root, "apps/app/negotiation.js"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/app/source.json"), "utf8"));

  for (const [route, approvedCopy] of routes) {
    const html = await readFile(resolve(root, `apps/app/${route}.html`), "utf8");
    assert.match(html, new RegExp(`data-source-route="#/app/${route}"`));
    assert.match(html, approvedCopy);
    assert.ok(server.includes(`"/app/${route}"`));
    assert.ok(provenance.destination.routes.includes(`/app/${route}`));
  }

  assert.match(behavior, /Telefones não podem ser compartilhados no chat/);
  assert.match(behavior, /E-mails não podem ser compartilhados no chat/);
  assert.match(behavior, /Links externos não podem ser compartilhados no chat/);
  assert.match(behavior, /QR Codes não podem ser compartilhados no chat/);
  assert.match(behavior, /protocolo #NEG-2025-0719/i);
  assert.match(behavior, /reservation-timer/);
  assert.match(behavior, /location\.pathname='\/app\/reservation-expired'/);
  for (const name of ["appChat", "appProposal", "appReservation", "setupProtectedChat", "setupNegotiation", "setupSafetyActions"]) {
    assert.ok(provenance.source.functions.includes(name));
  }
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});


test("transfers protected payment wallet refund and dispute journeys", async () => {
  const routes = [
    ["payment", /Escolha o método/],
    ["payment-success", /Pagamento aprovado!/],
    ["wallet", /Saldo e extrato/],
    ["wallet-cards", /Meus cartões/],
    ["refund", /Solicitar reembolso/],
    ["dispute", /Abrir disputa/],
  ];
  const behavior = await readFile(resolve(root, "apps/app/finance.js"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/app/source.json"), "utf8"));

  for (const [route, approvedCopy] of routes) {
    const html = await readFile(resolve(root, `apps/app/${route}.html`), "utf8");
    assert.match(html, new RegExp(`data-source-route="#/app/${route}"`));
    assert.match(html, approvedCopy);
    assert.ok(server.includes(`"/app/${route}"`));
    assert.ok(provenance.destination.routes.includes(`/app/${route}`));
  }

  const payment = await readFile(resolve(root, "apps/app/payment.html"), "utf8");
  assert.equal((payment.match(/name="pay"/g) ?? []).length, 5);
  assert.match(payment, /Valor protegido em custódia até o recebimento/);
  assert.match(behavior, /Cartão tokenizado com segurança/);
  assert.match(behavior, /\/v1\/payments\/tokenization-sessions/);
  assert.match(behavior, /\/v1\/payments\/intents/);
  assert.match(behavior, /FraldaCyclePaymentProvider/);
  assert.match(behavior, /sdkIntegrity/);
  assert.match(behavior, /'refunds'/);
  assert.match(behavior, /'disputes'/);
  assert.match(behavior, /setupRealPaymentCases/);
  assert.match(behavior, /Descreva a situação com pelo menos 10 caracteres/);
  const dispute = await readFile(resolve(root, "apps/app/dispute.html"), "utf8");
  assert.match(dispute, /valor permanece protegido em custódia/i);
  for (const name of ["appPayment", "appWallet", "appRefund", "appDispute", "setupPaymentFlow", "setupWallet"]) {
    assert.ok(provenance.source.functions.includes(name));
  }
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});


test("transfers the complete approved App logistics journey", async () => {
  const routes = [
    ["delivery-options", /Como deseja receber\?/],
    ["delivery", /Acompanhar entrega/],
    ["delivery-reschedule", /Reagendar entrega/],
    ["delivery-proof", /Prova de entrega/],
    ["delivery-confirm", /Você recebeu o produto\?/],
    ["delivery-rate", /Avaliar experiência/],
  ];
  const behavior = await readFile(resolve(root, "apps/app/logistics.js"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/app/source.json"), "utf8"));

  for (const [route, approvedCopy] of routes) {
    const html = await readFile(resolve(root, `apps/app/${route}.html`), "utf8");
    assert.match(html, new RegExp(`data-source-route="#/app/${route}"`));
    assert.match(html, approvedCopy);
    assert.ok(server.includes(`"/app/${route}"`));
    assert.ok(provenance.destination.routes.includes(`/app/${route}`));
  }

  assert.match(behavior, /delivery-refresh/);
  assert.match(behavior, /\/v1\/shipments/);
  assert.match(behavior, /activeShipmentId/);
  assert.match(behavior, /createRealShipment/);
  assert.match(behavior, /reschedule-submit/);
  assert.match(behavior, /delivery-problem-submit/);
  assert.match(behavior, /Avaliação enviada com sucesso/);
  const options = await readFile(resolve(root, "apps/app/delivery-options.html"), "utf8");
  assert.equal((options.match(/name="delivery-option"/g) ?? []).length, 4);
  for (const name of ["appDeliveryOptions", "appDelivery", "appDeliveryProof", "appDeliveryRate", "setupDeliveryTracking"]) {
    assert.ok(provenance.source.functions.includes(name));
  }
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});


test("closes the remaining approved App route inventory", async () => {
  const routes = [
    "auth-error", "auth-locked", "auth-offline", "notifications", "notification-settings",
    "profile", "profile-ads", "profile-history", "profile-reviews", "addresses", "settings",
    "my-impact", "help", "state-offline", "state-permission", "state-removed",
  ];
  const behavior = await readFile(resolve(root, "apps/app/profile.js"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/app/source.json"), "utf8"));

  for (const route of routes) {
    const html = await readFile(resolve(root, `apps/app/${route}.html`), "utf8");
    assert.match(html, new RegExp(`data-source-route="#/app/${route}"`));
    assert.match(html, /<h1>/);
    assert.ok(server.includes(`"/app/${route}"`));
    assert.ok(provenance.destination.routes.includes(`/app/${route}`));
  }

  assert.match(await readFile(resolve(root, "apps/app/notifications.html"), "utf8"), /Notificações/);
  assert.match(await readFile(resolve(root, "apps/app/profile.html"), "utf8"), /Ana Souza/);
  assert.match(await readFile(resolve(root, "apps/app/my-impact.html"), "utf8"), /Meu impacto/);
  assert.match(behavior, /setupNotifications\(\)/);
  assert.match(behavior, /setupNotificationSettings\(\)/);
  assert.match(behavior, /Novo código enviado com sucesso/);
  assert.match(behavior, /Conexão restabelecida/);
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});


test("closes the approved courier journey and the App surface", async () => {
  const routes = [
    ["home", /Minhas entregas/],
    ["job", /Detalhes da coleta/],
    ["route", /Rota em andamento/],
    ["proof", /Finalizar entrega/],
    ["history", /Histórico e repasses/],
  ];
  const behavior = await readFile(resolve(root, "apps/app/courier.js"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/app/source.json"), "utf8"));

  for (const [route, approvedCopy] of routes) {
    const html = await readFile(resolve(root, `apps/app/courier-${route}.html`), "utf8");
    assert.match(html, new RegExp(`data-source-route="#/courier/${route}"`));
    assert.match(html, approvedCopy);
    assert.ok(server.includes(`"/courier/${route}"`));
    assert.ok(provenance.destination.routes.includes(`/courier/${route}`));
  }

  assert.match(behavior, /Foto e localização registradas com segurança/);
  assert.match(behavior, /\/v1\/shipments/);
  assert.match(behavior, /uploadListingMedia/);
  assert.match(behavior, /deliveryProofMediaKey/);
  assert.match(await readFile(resolve(root, "apps/app/courier-proof.html"), "utf8"), /repasse será liberado em até 24 horas/i);
  for (const name of ["courierHome", "courierJob", "courierRoute", "courierProof", "courierHistory"]) {
    assert.ok(provenance.source.functions.includes(name));
  }
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});


test("transfers the approved Admin dashboard users RBAC ads and operations core", async () => {
  const routes = [
    ["index", "dashboard", /Painel administrativo/],
    ["users", "users", /Usuários/],
    ["roles", "roles", /Matriz de permissões/],
    ["ads", "ads", /Anúncios e produtos/],
    ["operations", "operations", /Operações/],
  ];
  const behavior = await readFile(resolve(root, "apps/admin/core.js"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/admin/source.json"), "utf8"));

  for (const [file, route, approvedCopy] of routes) {
    const html = await readFile(resolve(root, `apps/admin/${file}.html`), "utf8");
    assert.match(html, new RegExp(`data-source-route="#/admin/${route}"`));
    assert.match(html, approvedCopy);
    assert.ok(server.includes(`"/admin/${route}"`));
    assert.ok(provenance.destination.routes.includes(`/admin/${route}`));
  }

  assert.match(behavior, /setupAdmin\(\)/);
  assert.match(behavior, /setupAdminAds\(\)/);
  assert.match(behavior, /admin-user-search/);
  assert.match(behavior, /\/v1\/admin\/users/);
  assert.match(behavior, /loadLiveAdminUsers/);
  assert.match(behavior, /\/v1\/admin\/sessions/);
  assert.match(behavior, /\/v1\/admin\/invitations/);
  assert.match(behavior, /admin-user-invite-form/);
  assert.match(behavior, /loadLiveAdminSessions/);
  assert.match(behavior, /rbac-save/);
  assert.match(behavior, /admin-ad-search/);
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});


test("transfers Admin finance logistics and reports with impact kept in its approved location", async () => {
  const routes = [
    ["finance", /Financeiro, splits e disputas/],
    ["logistics", /Logística e entregadores/],
    ["reports", /Relatórios e inteligência/],
  ];
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/admin/source.json"), "utf8"));

  for (const [route, approvedCopy] of routes) {
    const html = await readFile(resolve(root, `apps/admin/${route}.html`), "utf8");
    assert.match(html, new RegExp(`data-source-route="#/admin/${route}"`));
    assert.match(html, approvedCopy);
    assert.ok(server.includes(`"/admin/${route}"`));
    assert.ok(provenance.destination.routes.includes(`/admin/${route}`));
  }

  const reports = await readFile(resolve(root, "apps/admin/reports.html"), "utf8");
  assert.match(reports, /impact/i);
  assert.equal(provenance.architectureNotes[0].area, "impact");
  assert.match(provenance.architectureNotes[0].detail, /No standalone admin impact route exists/);
  for (const name of ["adminFinance", "adminLogistics", "adminReports"]) assert.ok(provenance.source.functions.includes(name));
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});


test("transfers Admin data forecasts alerts and infrastructure", async () => {
  const routes = [
    ["data", /Dados e inteligência/],
    ["forecast", /Previsões e alertas/],
    ["alerts", /Alertas e observabilidade/],
    ["infrastructure", /Infraestrutura e observabilidade/],
  ];
  const behavior = await readFile(resolve(root, "apps/admin/intelligence.js"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/admin/source.json"), "utf8"));

  for (const [route, approvedCopy] of routes) {
    const html = await readFile(resolve(root, `apps/admin/${route}.html`), "utf8");
    assert.match(html, new RegExp(`data-source-route="#/admin/${route}"`));
    assert.match(html, approvedCopy);
    assert.ok(server.includes(`"/admin/${route}"`));
    assert.ok(provenance.destination.routes.includes(`/admin/${route}`));
  }

  assert.match(behavior, /setupAdminData\(\)/);
  assert.match(behavior, /setupAdminForecast\(\)/);
  assert.match(behavior, /setupAdminInfrastructure\(\)/);
  assert.match(behavior, /data-run-pipeline/);
  for (const name of ["adminData", "adminForecast", "adminAlerts", "adminInfrastructure"]) assert.ok(provenance.source.functions.includes(name));
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});


test("transfers Admin security moderation audit webhooks and settings governance", async () => {
  const routes = [
    ["security", /Segurança e autenticação administrativa/],
    ["moderation", /Moderação, segurança e antifraude/],
    ["audit", /Logs, auditoria e webhooks/],
    ["settings", /Configurações e integrações/],
  ];
  const behavior = await readFile(resolve(root, "apps/admin/governance.js"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/admin/source.json"), "utf8"));

  for (const [route, approvedCopy] of routes) {
    const html = await readFile(resolve(root, `apps/admin/${route}.html`), "utf8");
    assert.match(html, new RegExp(`data-source-route="#/admin/${route}"`));
    assert.match(html, approvedCopy);
    assert.ok(server.includes(`"/admin/${route}"`));
    assert.ok(provenance.destination.routes.includes(`/admin/${route}`));
  }

  assert.match(behavior, /setupAdminModeration\(\)/);
  assert.match(behavior, /setupAdminAudit\(\)/);
  assert.match(behavior, /\/v1\/admin\/audit-events/);
  assert.match(behavior, /audit-events\.csv/);
  assert.match(behavior, /auditPageSize/);
  assert.match(behavior, /audit-pagination/);
  assert.match(behavior, /loadLiveAudit/);
  assert.match(behavior, /setupAdminSettings\(\)/);
  assert.match(await readFile(resolve(root, "apps/admin/audit.html"), "utf8"), /webhook/i);
  assert.equal(provenance.architectureNotes.at(-1).area, "webhooks");
  assert.match(provenance.architectureNotes.at(-1).detail, /No standalone admin webhook route exists/);
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});


test("closes all nineteen approved Admin routes with growth launch and support", async () => {
  const routes = [
    ["partnerships", /Expansão e parcerias/],
    ["innovation", /Inovação e produtos/],
    ["launch", /Lançamento e suporte/],
  ];
  const behavior = await readFile(resolve(root, "apps/admin/growth.js"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/admin/source.json"), "utf8"));

  for (const [route, approvedCopy] of routes) {
    const html = await readFile(resolve(root, `apps/admin/${route}.html`), "utf8");
    assert.match(html, new RegExp(`data-source-route="#/admin/${route}"`));
    assert.match(html, approvedCopy);
    assert.ok(server.includes(`"/admin/${route}"`));
    assert.ok(provenance.destination.routes.includes(`/admin/${route}`));
  }

  assert.match(behavior, /setupAdminPartnerships\(\)/);
  assert.match(behavior, /setupAdminInnovation\(\)/);
  assert.match(behavior, /setupAdminLaunch\(\)/);
  assert.equal(provenance.source.routes.length, 19);
  assert.equal(provenance.destination.routes.length, 19);
  assert.equal(new Set(provenance.destination.routes).size, 19);
  assert.deepEqual(provenance.modifiedSourceFiles, []);
});

test("connects approved identity screens to the production API client", async () => {
  const [appAuth, siteAuth, client, reset, server] = await Promise.all([
    readFile(resolve(root, "apps/app/auth.js"), "utf8"),
    readFile(resolve(root, "apps/site/login.js"), "utf8"),
    readFile(resolve(root, "packages/contracts/api-client.js"), "utf8"),
    readFile(resolve(root, "apps/app/reset-password.html"), "utf8"),
    readFile(resolve(root, "tools/dev-server.mjs"), "utf8"),
  ]);
  for (const endpoint of ["/v1/auth/register", "/v1/auth/login", "/v1/auth/verification/confirm", "/v1/auth/password/request", "/v1/auth/password/reset"]) {
    assert.ok(appAuth.includes(endpoint) || siteAuth.includes(endpoint));
  }
  assert.match(client, /credentials: "include"/);
  assert.match(client, /class ApiError/);
  assert.match(reset, /data-architecture-route="\/app\/reset-password"/);
  assert.match(server, /"\/app\/reset-password"/);
});

test("connects approved marketplace screens to persistent API contracts", async () => {
  const files = await Promise.all([
    readFile(resolve(root, "packages/contracts/marketplace-ui.js"), "utf8"),
    readFile(resolve(root, "apps/site/search.js"), "utf8"),
    readFile(resolve(root, "apps/site/favorites.js"), "utf8"),
    readFile(resolve(root, "apps/site/detail.js"), "utf8"),
    readFile(resolve(root, "apps/site/publish.js"), "utf8"),
    readFile(resolve(root, "apps/app/search.js"), "utf8"),
    readFile(resolve(root, "apps/app/favorites.js"), "utf8"),
    readFile(resolve(root, "apps/app/publish.js"), "utf8"),
  ]);
  const joined = files.join("\n");
  for (const endpoint of ["/v1/listings", "/v1/favorites"]) assert.ok(joined.includes(endpoint));
  for (const binding of ["renderSiteSearch", "renderAppSearch", "renderFavorites", "publishListing", "setFavorite"]) {
    assert.ok(joined.includes(binding));
  }
  assert.match(files[0], /apiRequest/);
  assert.match(files[0], /navigator\.geolocation/);
  assert.match(files[0], /radiusKm/);
  assert.match(files[4], /fc\.lastListingId/);
  assert.match(files[7], /fc\.lastListingId/);
});
