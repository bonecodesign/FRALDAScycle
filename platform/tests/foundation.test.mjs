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

test("creates accessible shells synchronized with the approved prototype", async () => {
  for (const surface of Object.keys(SURFACES)) {
    const html = await readFile(resolve(root, "apps", surface, "index.html"), "utf8");
    assert.match(html, /<html lang="pt-BR"(?:\s[^>]*)?>/);
    assert.match(html, /<meta name="viewport"/);
    if (surface === "site") {
      assert.match(html, /data-source-route="#\/site\/home"/);
      assert.match(html, /Conectamos famílias/);
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


test("keeps the approved Site Home language without fictional operational claims", async () => {
  const html = await readFile(resolve(root, "apps/site/index.html"), "utf8");
  assert.match(html, /data-source-route="#\/site\/home"/);
  assert.match(html, /Conectamos famílias/);
  assert.match(html, /Reduzimos desperdícios/);
  assert.match(html, /Compre ou troque pacotes fechados/);
  assert.match(html, /Doe pacotes fechados ou abertos/);
  assert.match(html, /Uma jornada com regras transparentes/);
  assert.match(html, /Anúncios disponíveis/);
  assert.match(html, /Indicadores serão publicados após definição de metodologia/);
  assert.doesNotMatch(html, /7\.420|5\.080 kg|2\.120 kg|R\$ 18\.650|124 famílias/);
});

test("uses approved source assets through an explicit read-only adapter", async () => {
  const html = await readFile(resolve(root, "apps/site/index.html"), "utf8");
  const adapter = await readFile(resolve(root, "packages/ui/source-adapter.css"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/site/source.json"), "utf8"));

  assert.match(html, /\/source\/assets\/approved\/logo-approved\.png/);
  assert.match(html, /id="site-home-listings"/);
  assert.match(adapter, /@import url\("\/source\/styles\.css"\)/);
  assert.match(adapter, /@import url\("\/source\/fidelity\.css"\)/);
  assert.match(server, /approvedSourceFiles/);
  assert.match(server, /sourceAssetsRoot/);
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
  assert.ok(provenance.source.functions.includes("siteHome"));
});


test("transfers approved Site Search and Map as a dedicated route", async () => {
  const html = await readFile(resolve(root, "apps/site/search.html"), "utf8");
  const behavior = await readFile(resolve(root, "apps/site/search.js"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/site/source.json"), "utf8"));

  assert.match(html, /data-source-route="#\/site\/search"/);
  assert.match(html, /Encontre o que sua família precisa/);
  assert.match(html, /Resultados do marketplace/);
  assert.match(html, /Consultando anúncios/);
  assert.doesNotMatch(html, /128 resultados|data-map-product|Pampers Confort|Dados simulados/);
  assert.match(behavior, /renderSiteSearch/);
  assert.match(server, /pathname === "\/site\/search"/);
  for (const name of ["siteHome", "siteSearch", "resultsMap", "productCards", "setupMap"]) assert.ok(provenance.source.functions.includes(name));
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
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

  assert.match(detail, /Consultando anúncio/);
  assert.match(await readFile(resolve(root, "apps/site/detail.js"), "utf8"), /\/v1\/listings\//);
  assert.doesNotMatch(detail, /Pampers Confort|Juliana Silva|R\$ 45,00/);
  assert.match(seller, /Perfil público indisponível/);
  assert.doesNotMatch(seller, /Juliana Silva|4,9|36 avaliações|3 anúncios/);
  assert.match(favorites, /Seus favoritos/);
  assert.match(favorites, /Carregando seus favoritos/);
  assert.match(favoriteBehavior, /renderFavorites/);
  assert.doesNotMatch(favoriteBehavior, /let saved|const products/);
  assert.match(server, /"\/site\/detail", "\/site\/seller", "\/site\/favorites"/);
  for (const name of ["siteDetail", "siteSeller", "siteFavorites", "setupSiteFavorites"]) {
    assert.ok(provenance.source.functions.includes(name));
  }
  assert.equal(provenance.architectureAdditions[0].name, "productCard");
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
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
  assert.match(publishBehavior, /readListingPhoto/);
  assert.doesNotMatch(publishBehavior, /\/source\/assets\/approved\/pampers-approved\.png/);
  assert.match(impact, /Metodologia antes dos números/);
  assert.match(impact, /Indicadores quantitativos ainda não publicados/);
  assert.doesNotMatch(impact, /data-impact-value|data-impact-place|7\.420|5\.080|2\.120|18\.650/);
  assert.match(impactBehavior, /iconography/);
  assert.match(help, /Como podemos ajudar\?/);
  assert.match(help, /Compra protegida/);
  assert.match(server, /"\/site\/publish", "\/site\/impact", "\/site\/help"/);
  for (const name of ["sitePublish", "setupSitePublish", "siteImpact", "setupSiteImpact", "siteHelp"]) {
    assert.ok(provenance.source.functions.includes(name));
  }
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
});


test("closes the complete approved Site route inventory and records source changes", async () => {
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
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
});


test("transfers the complete approved App identity journey", async () => {
  const routes = [
    ["index", "splash", /Economia circular para famílias e para o planeta/],
    ["onboarding", "onboarding", /Pequenas escolhas,<br>grandes mudanças/],
    ["login", "login", /Bem-vindo\(a\)! 👋/],
    ["register", "register", /Criar sua conta/],
    ["recovery", "recovery", /Recuperar senha/],
    ["verify", "verify", /Digite o código de 6 dígitos/],
    ["home", "home", /Encontre, troque ou doe/],
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
  assert.match(behavior, /Solicitação de novo código recebida/);
  assert.match(behavior, /location\.pathname/);
  const verifyHtml = await readFile(resolve(root, "apps/app/verify.html"), "utf8");
  assert.equal((verifyHtml.match(/maxlength="1"/g) ?? []).length, 6);
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
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
  assert.match(search, /Os resultados serão consultados diretamente no marketplace/);
  assert.doesNotMatch(search, /128 resultados|Pampers Confort|0,8 km|data-map-product/);
  assert.match(searchBehavior, /renderAppSearch/);
  assert.doesNotMatch(searchBehavior, /const products=|setTimeout/);
  assert.match(favorites, /Itens salvos/);
  assert.match(favorites, /Consultando favoritos/);
  assert.doesNotMatch(favorites, /Anúncios \(3\)|Pampers Confort|Huggies Natural Care/);
  assert.match(favoritesBehavior, /renderFavorites/);

  for (let step = 1; step <= 8; step += 1) {
    const route = `publish-${step}`;
    const html = await readFile(resolve(root, `apps/app/${route}.html`), "utf8");
    assert.match(html, new RegExp(`data-source-route="#/app/${route}"`));
    assert.match(html, new RegExp(`Etapa ${step} de 8`));
    assert.ok(provenance.destination.routes.includes(`/app/${route}`));
  }

  assert.match(publishBehavior, /Adicione pelo menos uma foto do produto/);
  assert.match(publishBehavior, /Anúncio enviado para revisão/);
  assert.match(server, /\/app\\\/publish-\[1-8\]/);
  for (const name of ["appSearch", "setupSearchStates", "appFavorites", "appPublish", "setupPublishValidation"]) {
    assert.ok(provenance.source.functions.includes(name));
  }
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
});


test("transfers payment-gated operational chat without proposal or reservation routes", async () => {
  const [chat, safety, evidence, behavior, server] = await Promise.all([
    readFile(resolve(root, "apps/app/chat.html"), "utf8"),
    readFile(resolve(root, "apps/app/safety.html"), "utf8"),
    readFile(resolve(root, "apps/app/negotiation-evidence.html"), "utf8"),
    readFile(resolve(root, "apps/app/negotiation.js"), "utf8"),
    readFile(resolve(root, "tools/dev-server.mjs"), "utf8"),
  ]);
  const provenance = JSON.parse(await readFile(resolve(root, "apps/app/source.json"), "utf8"));

  assert.match(chat, /Chat somente após pagamento/);
  assert.match(chat, /finalidade|operacional/i);
  assert.match(safety, /Opções da conversa/);
  assert.match(evidence, /Evidências da negociação/);
  assert.match(behavior, /\/v1\/transactions\/.*chat-access/);
  assert.doesNotMatch(behavior, /fc\.paymentConfirmed/);
  assert.match(behavior, /Telefones não podem ser compartilhados no chat/);
  assert.match(behavior, /E-mails não podem ser compartilhados no chat/);
  assert.match(behavior, /Links externos não podem ser compartilhados no chat/);
  assert.match(behavior, /QR Codes não podem ser compartilhados no chat/);
  assert.doesNotMatch(behavior, /proposal-form|setupNegotiation/);
  assert.doesNotMatch(server, /\/app\/proposal|\/app\/reservation/);
  assert.ok(provenance.destination.routes.includes("/app/chat"));
  assert.ok(provenance.destination.routes.includes("/app/safety"));
  assert.ok(provenance.destination.routes.includes("/app/negotiation-evidence"));
  assert.ok(!provenance.destination.routes.some((route) => route.includes("/app/proposal")));
  for (const name of ["appChat", "setupProtectedChat", "setupSafetyActions"]) {
    assert.ok(provenance.source.functions.includes(name));
  }
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
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
  assert.equal((payment.match(/name="pay"/g) ?? []).length, 3);
  assert.doesNotMatch(payment, /boleto/i);
  assert.doesNotMatch(behavior, /boleto/i);
  assert.doesNotMatch(payment, /cartão de débito|value="debit"/i);
  assert.match(payment, /Valor protegido em custódia até o recebimento/);
  const actions = await readFile(resolve(root, "apps/app/action-states.js"), "utf8");
  assert.match(behavior, /import \{ setupWalletLogisticsExtras \} from "\/apps\/app\/action-states\.js"/);
  assert.match(behavior, /setupWalletLogisticsExtras\(\);/);
  assert.match(actions, /Cartões salvos estarão disponíveis após a homologação do provedor de pagamento/);
  assert.doesNotMatch(actions, /Cartão tokenizado com segurança|Cartão adicionado com segurança/);
  assert.doesNotMatch(behavior, /Saldo adicionado|PIX-2387-9841-1123/);
  assert.match(behavior, /\/v1\/payments\/tokenization-sessions/);
  assert.match(behavior, /\/v1\/payments\/intents/);
  assert.match(behavior, /FraldaCyclePaymentProvider/);
  assert.match(behavior, /sdkIntegrity/);
  assert.match(behavior, /'refunds'/);
  assert.match(behavior, /'disputes'/);
  assert.match(behavior, /setupRealPaymentCases/);
  assert.match(behavior, /Descreva a situação com pelo menos 10 caracteres/);
  const wallet = await readFile(resolve(root, "apps/app/wallet.html"), "utf8");
  const walletCards = await readFile(resolve(root, "apps/app/wallet-cards.html"), "utf8");
  assert.match(wallet, /Nenhuma movimentação carregada/);
  assert.doesNotMatch(wallet, /R\$ 32,50|#FC-8F3A2B|#FC-3AB87D/);
  assert.match(walletCards, /Nenhum cartão carregado/);
  assert.doesNotMatch(walletCards, /final 4242|final 9012/);
  assert.doesNotMatch(behavior, /Disponível: R\$ 32,50|faltam R\$ 18,50/);
  const dispute = await readFile(resolve(root, "apps/app/dispute.html"), "utf8");
  assert.match(dispute, /valor permanece protegido em custódia/i);
  for (const name of ["appPayment", "appWallet", "appRefund", "appDispute", "setupPaymentFlow", "setupWallet"]) {
    assert.ok(provenance.source.functions.includes(name));
  }
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
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
  const actions = await readFile(resolve(root, "apps/app/action-states.js"), "utf8");
  assert.match(behavior, /import \{ setupWalletLogisticsExtras, setupActionStates \} from "\/apps\/app\/action-states\.js"/);
  assert.match(behavior, /setupWalletLogisticsExtras\(\);/);
  assert.match(behavior, /setupActionStates\(\);/);
  assert.match(actions, /reschedule-submit/);
  assert.match(actions, /delivery-problem-submit/);
  assert.match(actions, /O reagendamento ainda não está integrado/);
  assert.doesNotMatch(actions, /Avaliação enviada com sucesso|Entrega reagendada com sucesso/);
  assert.doesNotMatch(behavior, /entregador a 0,8 km/);
  const options = await readFile(resolve(root, "apps/app/delivery-options.html"), "utf8");
  assert.equal((options.match(/name="delivery-option"/g) ?? []).length, 4);
  for (const name of ["appDeliveryOptions", "appDelivery", "appDeliveryProof", "appDeliveryRate", "setupDeliveryTracking"]) {
    assert.ok(provenance.source.functions.includes(name));
  }
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
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
    assert.match(html, /<h1(?:\s[^>]*)?>/);
    assert.ok(server.includes(`"/app/${route}"`));
    assert.ok(provenance.destination.routes.includes(`/app/${route}`));
  }

  assert.match(await readFile(resolve(root, "apps/app/notifications.html"), "utf8"), /Notificações/);
  const profile = await readFile(resolve(root, "apps/app/profile.html"), "utf8");
  const notifications = await readFile(resolve(root, "apps/app/notifications.html"), "utf8");
  assert.match(profile, /Carregando perfil/);
  assert.match(behavior, /\/v1\/auth\/session/);
  assert.doesNotMatch(profile, /Ana Souza|Membro desde|★ 4,9|<strong>12<\/strong>|<strong>36<\/strong>/);
  assert.match(notifications, /Nenhuma notificação carregada/);
  assert.doesNotMatch(notifications, /R\$ 51,00|Juliana|1,2 km|4 notificações|Nova contraproposta/);
  assert.doesNotMatch(behavior, /128 resultados encontrados|Pagamento aprovado e protegido|Avaliação enviada com sucesso/);
  assert.match(await readFile(resolve(root, "apps/app/my-impact.html"), "utf8"), /Meu impacto/);
  const impact = await readFile(resolve(root, "apps/app/my-impact.html"), "utf8");
  const history = await readFile(resolve(root, "apps/app/profile-history.html"), "utf8");
  const offline = await readFile(resolve(root, "apps/app/state-offline.html"), "utf8");
  assert.match(impact, /Métricas ainda não disponíveis/);
  assert.doesNotMatch(impact, /18<\/strong>|12<\/strong>|8,4 kg|19,6 kg|75%|jan–jul/);
  assert.match(history, /Nenhum histórico carregado/);
  assert.doesNotMatch(history, /Pampers Confort|Huggies Supreme|#FC-|R\$ 51,00|R\$ 38,00/);
  assert.doesNotMatch(offline, /Nenhuma ação será perdida/);
  assert.match(behavior, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(behavior, /setupNotifications\(\)/);
  assert.match(behavior, /setupNotificationSettings\(\)/);
  assert.match(behavior, /Conexão restabelecida/);
  assert.match(behavior, /apiRequest\('\/health'\)/);
  assert.doesNotMatch(behavior, /setTimeout/);
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
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

  assert.match(behavior, /Foto registrada com segurança/);
  assert.match(behavior, /\/v1\/shipments/);
  assert.match(behavior, /uploadListingMedia/);
  assert.match(behavior, /deliveryProofMediaKey/);
  const courierPages = await Promise.all(routes.map(([route]) => readFile(resolve(root, `apps/app/courier-${route}.html`), "utf8")));
  assert.match(courierPages[0], /Nenhuma entrega carregada/);
  assert.match(courierPages[4], /Nenhum histórico carregado/);
  assert.doesNotMatch(courierPages.join("\n"), /Carlos|Ana Souza|#FC-|R\$ 86,50|R\$ 19,00|97,2%|4,9 ★|repasse será liberado em até 24 horas/i);
  assert.match(behavior, /Selecione uma entrega real antes de enviar o comprovante/);
  for (const name of ["courierHome", "courierJob", "courierRoute", "courierProof", "courierHistory"]) {
    assert.ok(provenance.source.functions.includes(name));
  }
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
});


test("transfers the approved Admin dashboard users RBAC ads and operations core", async () => {
  const routes = [
    ["index", "dashboard", /Painel administrativo/],
    ["users", "users", /Usuários/],
    ["roles", "roles", /Matriz RBAC implementada/],
    ["ads", "ads", /Catálogo registrado/],
    ["operations", "operations", /Operações/],
  ];
  const behavior = await readFile(resolve(root, "apps/admin/account-management.js"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  const provenance = JSON.parse(await readFile(resolve(root, "apps/admin/source.json"), "utf8"));

  for (const [file, route, approvedCopy] of routes) {
    const html = await readFile(resolve(root, `apps/admin/${file}.html`), "utf8");
    assert.match(html, new RegExp(`data-source-route="#/admin/${route}"`));
    assert.match(html, approvedCopy);
    assert.ok(server.includes(`"/admin/${route}"`));
    assert.ok(provenance.destination.routes.includes(`/admin/${route}`));
  }

  assert.match(behavior, /\/v1\/admin\/users/);
  assert.match(behavior, /\/v1\/admin\/invitations/);
  assert.match(behavior, /\/v1\/admin\/catalog-snapshot/);
  assert.match(behavior, /\/v1\/admin\/access-snapshot/);
  assert.doesNotMatch(behavior, /data-ad-action|rbac-save|rbac-new-role/);
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
});


test("transfers Admin finance logistics and reports with impact kept in its approved location", async () => {
  const routes = [
    ["finance", /Pagamentos registrados/],
    ["logistics", /Entregas registradas/],
    ["reports", /Relatório operacional/],
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
  assert.match(reports, /Indicadores ainda indisponíveis/);
  assert.equal(provenance.architectureNotes[0].area, "impact");
  assert.match(provenance.architectureNotes[0].detail, /No standalone admin impact route exists/);
  for (const name of ["adminFinance", "adminLogistics", "adminReports"]) assert.ok(provenance.source.functions.includes(name));
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
});


test("transfers Admin data forecasts alerts and infrastructure", async () => {
  const routes = [
    ["data", /Dados e inteligência/],
    ["forecast", /Previsões e alertas/],
    ["alerts", /Pendências operacionais/],
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

  assert.match(behavior, /serviços reais/);
  assert.doesNotMatch(behavior, /setTimeout|data-run-pipeline|forecast-refresh|infra-load-test/);
  for (const name of ["adminData", "adminForecast", "adminAlerts", "adminInfrastructure"]) assert.ok(provenance.source.functions.includes(name));
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
});


test("transfers Admin security moderation audit webhooks and settings governance", async () => {
  const routes = [
    ["security", /Segurança administrativa/],
    ["moderation", /Moderação e recursos/],
    ["audit", /Auditoria e webhooks recebidos/],
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

  assert.match(behavior, /\/v1\/admin\/audit-events/);
  assert.match(behavior, /\/v1\/admin\/webhook-events/);
  assert.match(behavior, /audit-events\.csv/);
  assert.match(behavior, /pageSize/);
  assert.match(behavior, /loadAudit/);
  const securityBehavior = await readFile(resolve(root, "apps/admin/security-management.js"), "utf8");
  const moderationBehavior = await readFile(resolve(root, "apps/admin/moderation-management.js"), "utf8");
  assert.match(securityBehavior, /\/v1\/admin\/sessions/);
  assert.match(moderationBehavior, /\/v1\/moderation\/decisions/);
  assert.match(await readFile(resolve(root, "apps/admin/audit.html"), "utf8"), /webhook/i);
  assert.equal(provenance.architectureNotes.at(-1).area, "webhooks");
  assert.match(provenance.architectureNotes.at(-1).detail, /No standalone admin webhook route exists/);
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
});


test("closes all nineteen approved Admin routes with growth launch and support", async () => {
  const routes = [
    ["partnerships", /Expansão e parcerias/],
    ["innovation", /Inovação e produtos/],
    ["launch", /Piloto interno e suporte/],
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

  assert.match(behavior, /nenhuma ação comercial ou experimental é simulada/);
  assert.doesNotMatch(behavior, /setTimeout|data-partner-review|data-experiment-review|data-launch-evidence/);
  assert.match(await readFile(resolve(root, "apps/admin/support-management.js"), "utf8"), /\/v1\/support\/tickets/);
  assert.equal(provenance.source.routes.length, 19);
  assert.equal(provenance.destination.routes.length, 19);
  assert.equal(new Set(provenance.destination.routes).size, 19);
  assert.deepEqual(provenance.modifiedSourceFiles, ["app.js", "qa-regression.mjs"]);
});

test("protects every Admin module with email and password authentication", async () => {
  const login = await readFile(resolve(root, "apps/admin/login.html"), "utf8");
  const auth = await readFile(resolve(root, "apps/admin/auth.js"), "utf8");
  const server = await readFile(resolve(root, "tools/dev-server.mjs"), "utf8");
  assert.match(login, /type="email"/);
  assert.match(login, /type="password"/);
  assert.match(login, /minlength="12"/);
  assert.match(auth, /\/v1\/auth\/login/);
  assert.match(auth, /\/v1\/auth\/session/);
  assert.match(auth, /ADMIN_ROLES/);
  assert.match(auth, /\/v1\/auth\/logout/);
  assert.match(auth, /\/v1\/auth\/mfa\/confirm/);
  assert.doesNotMatch(auth, /LOCAL_DEMO|acesso aberto|autenticação administrativa está dispensada/);
  assert.match(login, /id="admin-mfa-form"/);
  assert.match(login, /autocomplete="one-time-code"/);
  assert.match(server, /\/admin\/login/);
  for (const module of ["core.js", "governance.js", "intelligence.js", "growth.js"]) {
    assert.match(await readFile(resolve(root, `apps/admin/${module}`), "utf8"), /\/apps\/admin\/auth\.js/);
  }
});

test("connects approved identity screens to the production API client", async () => {
  const [appAuth, siteAuth, client, reset, server, verify] = await Promise.all([
    readFile(resolve(root, "apps/app/auth.js"), "utf8"),
    readFile(resolve(root, "apps/site/login.js"), "utf8"),
    readFile(resolve(root, "packages/contracts/api-client.js"), "utf8"),
    readFile(resolve(root, "apps/app/reset-password.html"), "utf8"),
    readFile(resolve(root, "tools/dev-server.mjs"), "utf8"),
    readFile(resolve(root, "apps/app/verify.html"), "utf8"),
  ]);
  for (const endpoint of ["/v1/auth/register", "/v1/auth/login", "/v1/auth/verification/confirm", "/v1/auth/password/request", "/v1/auth/password/reset"]) {
    assert.ok(appAuth.includes(endpoint) || siteAuth.includes(endpoint));
  }
  assert.match(client, /credentials: "include"/);
  assert.match(client, /class ApiError/);
  assert.match(reset, /data-architecture-route="\/app\/reset-password"/);
  assert.match(server, /"\/app\/reset-password"/);
  assert.doesNotMatch(appAuth, /LOCAL_DEMO|location\.replace\("\/app\/home"\)/);
  assert.doesNotMatch(verify, /99900-0000|value="[1-6]"/);
  assert.match(verify, /o contato informado anteriormente/);
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

