import fs from "node:fs";
import vm from "node:vm";

const appPath = new URL("./app.js", import.meta.url);
const cssPath = new URL("./fidelity.css", import.meta.url);
const htmlPath = new URL("./index.html", import.meta.url);
const advancedPath = new URL("./advanced-components.js", import.meta.url);
const tokensPath = new URL("./design-tokens.js", import.meta.url);
const responsivePath = new URL("./responsive-lab.js", import.meta.url);
const accessibilityPath = new URL("./accessibility-lab.js", import.meta.url);
const motionPath = new URL("./motion-lab.js", import.meta.url);
const app = fs.readFileSync(appPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const html = fs.readFileSync(htmlPath, "utf8");
const advanced = fs.readFileSync(advancedPath, "utf8");
const tokens = fs.readFileSync(tokensPath, "utf8");
const responsive = fs.readFileSync(responsivePath, "utf8");
const accessibilityLab = fs.readFileSync(accessibilityPath, "utf8");
const motionLab = fs.readFileSync(motionPath, "utf8");
const checks = [];
const check = (name, condition, detail = "") =>
  checks.push({ name, status: condition ? "PASS" : "FAIL", detail });

const routeBlock = app.match(/const routes=\{([\s\S]*?)\n\};/)?.[1] ?? "";
const routes = new Set([...routeBlock.matchAll(/'([^']+)'\s*:/g)].map((match) => match[1]));
const links = [...app.matchAll(/href="#\/([^"]+)"/g)].map((match) => match[1]);
const unresolved = [...new Set(links.filter((link) =>
  !link.includes("${") &&
  !routes.has(link) &&
  !/^app\/publish-\d+$/.test(link)
))];

check("Rotas internas resolvidas", unresolved.length === 0, unresolved.join(", "));
check(
  "Tokens, temas e documentação visual",
  routes.has("site/design-tokens") &&
  /design-tokens\.js/.test(html) &&
  /function siteDesignTokens/.test(tokens) &&
  /function setupDesignTokens/.test(tokens) &&
  /applyStoredTheme/.test(tokens) &&
  /token-color-grid/.test(tokens) &&
  /spacing-tokens/.test(tokens) &&
  /radius-tokens/.test(tokens) &&
  /motion-tokens/.test(tokens) &&
  /breakpoint-grid/.test(tokens) &&
  /theme-toggle/.test(tokens) &&
  /tokens-export/.test(tokens)
);
check(
  "Breakpoints oficiais navegáveis",
  routes.has("site/responsive-lab") &&
  /responsive-lab\.js/.test(html) &&
  /function siteResponsiveLab/.test(responsive) &&
  /function setupResponsiveLab/.test(responsive) &&
  /mobile:\{label:'Mobile',width:390,columns:4,gutter:16\}/.test(responsive) &&
  /tablet:\{label:'Tablet',width:768,columns:8,gutter:24\}/.test(responsive) &&
  /desktop:\{label:'Desktop',width:1024,columns:12,gutter:24\}/.test(responsive) &&
  /wide:\{label:'Wide',width:1440,columns:12,gutter:32\}/.test(responsive) &&
  /Mapa dos resultados/.test(responsive)
);
check(
  "Auditoria WCAG 2.1 AA navegável",
  routes.has("site/accessibility-lab") &&
  /accessibility-lab\.js/.test(html) &&
  /function siteAccessibilityLab/.test(accessibilityLab) &&
  /function setupAccessibilityLab/.test(accessibilityLab) &&
  /Contraste AA/.test(accessibilityLab) &&
  /Teclado completo/.test(accessibilityLab) &&
  /Foco visível/.test(accessibilityLab) &&
  /Leitores de tela/.test(accessibilityLab) &&
  /Toque mínimo/.test(accessibilityLab) &&
  /Texto escalável/.test(accessibilityLab) &&
  /aria-live/.test(accessibilityLab) &&
  /speechSynthesis/.test(accessibilityLab) &&
  /scale-200/.test(accessibilityLab) &&
  /high-contrast/.test(accessibilityLab)
);
check("Mapa após resultados", /searchResultsMarkup[\s\S]*resultsMap\(\)/.test(app));
check(
  "Motion oficial e redução de movimento",
  routes.has("site/motion-lab") &&
  /motion-lab\.js/.test(html) &&
  /function siteMotionLab/.test(motionLab) &&
  /function setupMotionLab/.test(motionLab) &&
  /Fade in/.test(motionLab) &&
  /Slide up/.test(motionLab) &&
  /Hover elevation/.test(motionLab) &&
  /Loading spinner/.test(motionLab) &&
  /Feedback check/.test(motionLab) &&
  /150 ms/.test(motionLab) &&
  /250 ms/.test(motionLab) &&
  /300 ms/.test(motionLab) &&
  /1000 ms/.test(motionLab) &&
  /prefers-reduced-motion/.test(css) &&
  /motion-reduced/.test(css)
);
check("Busca web com mapa", /function siteSearch[\s\S]*resultsMap\(\)/.test(app));
check("Busca app com mapa", /function searchResultsMarkup[\s\S]*resultsMap\(\)/.test(app));
check("Publicação em 8 etapas com catálogo e doação aberta", /publishBody\(step\)/.test(app) && /step<8/.test(app) && /const diaperCatalog=/.test(app) && /Infantil descartável/.test(app) && /Descartável para piscina/.test(app) && /Outro modelo/.test(app) && /app-open-package-attestation/.test(app));
check("Pagamento protegido somente com métodos aprovados", /appPayment/.test(app) && /setupPaymentFlow/.test(app) && /Cartão de crédito/.test(app) && /Saldo FraldaCycle/.test(app) && !/Boleto bancário/.test(app) && !/Cartão de débito/.test(app));
check("Rastreamento de entrega", /appDelivery/.test(app) && /setupDeliveryTracking/.test(app));
check("Painel administrativo protegido por login e senha", ["admin/login", "admin/dashboard", "admin/operations", "admin/reports"].every((route) => routes.has(route)) && /function adminLogin/.test(app) && /admin-login-form/.test(app) && /type="password"/.test(app) && /fc\.prototypeAdminAuthenticated/.test(app));
check(
  "Módulo financeiro administrativo",
  routes.has("admin/finance")
    && /function adminFinance/.test(app)
    && /Regras de split aprovadas/.test(app)
    && /Venda[\s\S]*8%/.test(app)
    && /Troca[\s\S]*5%/.test(app)
    && /Entrega[\s\S]*5%/.test(app)
    && /Doação[\s\S]*0%/.test(app),
);
check(
  "Módulo logístico administrativo",
  routes.has("admin/logistics")
    && /function adminLogistics/.test(app)
    && /Mapa da operação logística/.test(app)
    && /Entregadores/.test(app)
    && /Modalidades e repasse/.test(app),
);
check("Responsividade mobile", /body:has\(\.app-stage\) \.phone\{width:100vw/.test(css));
check("Navegação inferior fixa", /body:has\(\.app-stage\) \.phone-nav\{position:fixed/.test(css));
check(
  "Assets aprovados",
  /assets\/approved\/pampers-approved\.png/.test(app)
    && /assets\/approved\/onboarding-approved\.png/.test(css),
);

const normalizeSource = app.match(/function normalizeText\(value\)\{[\s\S]*?\}/)?.[0];
const blockedSource = app.match(/function blockedChatContent\(value\)\{[\s\S]*?return''\}/)?.[0];
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${normalizeSource};${blockedSource};this.blockedChatContent=blockedChatContent`, sandbox);
const blockedSamples = [
  ["telefone numérico", "me chama no 31999991234"],
  ["telefone escrito", "três um nove nove nove nove nove um dois três quatro"],
  ["link", "acesse https://exemplo.com"],
  ["e-mail", "fale comigo em ana@gmail.com"],
  ["Instagram", "meu instagram é @ana.silva"],
  ["Facebook", "procure no facebook Ana Silva"],
  ["QR Code", "vou mandar um qrcode"],
];
for (const [label, value] of blockedSamples) {
  check(`Bloqueio: ${label}`, Boolean(sandbox.blockedChatContent(value)));
}
check("Chat permite mensagem segura", sandbox.blockedChatContent("Posso retirar amanhã no Bairro Castelo?") === "");

check("Split venda 8%", /VENDA[\s\S]*8%|Venda 8%/i.test(app));
check("Split troca 5%", /TROCA[\s\S]*5%|Troca 5%/i.test(app));
check("Split entrega 5%", /ENTREGA[\s\S]*5%|Entrega 5%/i.test(app));
check("Doação sem taxa", /Doações não possuem taxa/.test(app) || /Doação[\s\S]*Sem taxa/.test(app));

check("2FA administrativo", routes.has("admin/security") && /function adminSecurity/.test(app) && /admin-2fa-login/.test(app) && /admin-2fa-code/.test(app));
check("Exportações e agendamento administrativo", /data-report-export="CSV"/.test(app) && /data-report-export="PDF"/.test(app) && /data-report-export="XLSX"/.test(app) && /report-schedule-form/.test(app));

check("Gestão RBAC administrativa", routes.has("admin/roles") && /function adminRoles/.test(app) && /rbac-role-select/.test(app) && /rbac-save/.test(app) && /data-permission/.test(app));
check("Experiência própria do entregador", ["courier/home","courier/job","courier/route","courier/proof","courier/history"].every((route)=>routes.has(route)) && /function courierHome/.test(app) && /function courierProof/.test(app) && /Histórico e repasses/.test(app));
check("Estados globais obrigatórios", ["app/state-offline","app/state-permission","app/state-removed"].every((route)=>routes.has(route)) && /function appStateOffline/.test(app) && /function appStatePermission/.test(app) && /function appStateRemoved/.test(app) && /Você está offline/.test(app) && /Localização desativada/.test(app) && /Este anúncio foi removido/.test(app));
check("Módulo administrativo de anúncios", routes.has("admin/ads") && /function adminAds/.test(app) && /admin-ad-search/.test(app) && /data-ad-action="review"/.test(app) && /data-ad-action="pause"/.test(app) && /data-ad-action="remove"/.test(app) && /Aprovar anúncio/.test(app));
check("Moderação e antifraude administrativos", routes.has("admin/moderation") && /function adminModeration/.test(app) && /moderation-search/.test(app) && /data-case-review/.test(app) && /data-moderation-decision="dismiss"/.test(app) && /data-moderation-decision="warn"/.test(app) && /data-moderation-decision="block"/.test(app) && /Histórico de decisões/.test(app));
check("Logs, auditoria e webhooks administrativos", routes.has("admin/audit") && /function adminAudit/.test(app) && /audit-search/.test(app) && /data-audit-row/.test(app) && /Monitor de webhooks/.test(app) && /data-webhook-retry/.test(app) && /Logs técnicos/.test(app) && /Trilha de auditoria/.test(app));
check("Configurações e integrações administrativas", routes.has("admin/settings") && /function adminSettings/.test(app) && /platform-save/.test(app) && /integration-test-all/.test(app) && /data-integration-test/.test(app) && /maintenance-toggle/.test(app) && /Venda[\s\S]*8%/.test(app) && /Troca[\s\S]*5%/.test(app) && /Entrega[\s\S]*5%/.test(app) && /Doação[\s\S]*0%/.test(app));
check("ETL, Data Warehouse e qualidade de dados", routes.has("admin/data") && /function adminData/.test(app) && /data-run-pipeline/.test(app) && /data-job-run/.test(app) && /Catálogo do Data Warehouse/.test(app) && /Qualidade dos dados/.test(app) && /Governança e privacidade/.test(app) && /setupAdminData/.test(app));
check("Previsão de demanda e alertas inteligentes", routes.has("admin/forecast") && /function adminForecast/.test(app) && /forecast-refresh/.test(app) && /forecast-horizon/.test(app) && /Demanda prevista por produto/.test(app) && /Alertas inteligentes/.test(app) && /Controles responsáveis/.test(app) && /setupAdminForecast/.test(app));
check("Painel completo de impacto", routes.has("site/impact") && /function siteImpact/.test(app) && /impact-period/.test(app) && /impact-region/.test(app) && /Distribuição geográfica/.test(app) && /Instituições e iniciativas apoiadas/.test(app) && /Empregos gerados/.test(app) && /Meta anual/.test(app) && /setupSiteImpact/.test(app));

check("Escalabilidade e observabilidade", routes.has("admin/infrastructure") && /function adminInfrastructure/.test(app) && /Arquitetura de alta disponibilidade/.test(app) && /teste de carga/i.test(app) && /Logs e observabilidade/.test(app) && /Backups e recupera/.test(app) && /setupAdminInfrastructure/.test(app));
check("Expansão e parcerias", routes.has("admin/partnerships") && /function adminPartnerships/.test(app) && /Funil de expansão/.test(app) && /Mapa de expansão/.test(app) && /Status das parcerias/.test(app) && /Receita por fonte/.test(app) && /Canais de aquisição/.test(app) && /Documentos e modelos/.test(app) && /setupAdminPartnerships/.test(app));

check("Hub de inovação e portfólio", routes.has("admin/innovation") && /function adminInnovation/.test(app) && /Funil de inovação/.test(app) && /Portfólio de novos produtos/.test(app) && /Testes com usuários/.test(app) && /Experimentos ativos/.test(app) && /Roadmap de produtos/.test(app) && /Backlog de inovação/.test(app) && /setupAdminInnovation/.test(app));
check("Finalização, suporte e pós-lançamento", routes.has("admin/launch") && /function adminLaunch/.test(app) && /Checklist de lançamento/.test(app) && /Performance pós go-live/.test(app) && /Canais de suporte ativos/.test(app) && /Monitoramento e alertas/.test(app) && /Adesão inicial/.test(app) && /Feedback inicial dos usuários/.test(app) && /Próximos passos pós-lançamento/.test(app) && /setupAdminLaunch/.test(app));

check("Contraproposta, recusa e evidencias", routes.has("app/negotiation-evidence") && /function appNegotiationEvidence/.test(app) && /proposal-reject/.test(app) && /Evid.ncias da negocia..o/.test(app) && /Proposta original/.test(app) && /Contraproposta recebida/.test(app) && /Protocolo #NEG/.test(app) && /evidence-export/.test(app));
check("Favoritos web com estados completos", routes.has("site/favorites") && /function siteFavorites/.test(app) && /function setupSiteFavorites/.test(app) && /Carregando seus favoritos/.test(app) && /Nenhum favorito salvo/.test(app) && /data-remove-site-favorite/.test(app) && /site-favorites-clear/.test(app) && /#\/site\/favorites/.test(html));
check("Perfil público web do vendedor", routes.has("site/seller") && /function siteSeller/.test(app) && /Perfil verificado/.test(app) && /Reputação na comunidade/.test(app) && /Indicadores de confiança/.test(app) && /Anúncios ativos/.test(app) && /#\/site\/seller/.test(app));
check("Publicação web em 8 etapas", routes.has("site/publish") && /function setupSitePublish/.test(app) && /data-site-publish-step/.test(app) && /Splits aprovados/.test(app) && /Adicione pelo menos uma foto/.test(app) && /Anúncio publicado/.test(app) && /site-open-package-attestation/.test(app) && /Pacote aberto somente pode ser doado/.test(app));
check("Estados completos de autenticação", ["app/auth-error", "app/auth-locked", "app/auth-offline"].every((route) => routes.has(route)) && /function appAuthError/.test(app) && /function appAuthLocked/.test(app) && /function appAuthOffline/.test(app) && /Acesso temporariamente bloqueado/.test(app) && /Verificando conexão/.test(app));
check("Busca app com filtros, ordenação e mapa", /app-filter-type/.test(app) && /app-filter-size/.test(app) && /app-filter-brand/.test(app) && /app-filter-distance/.test(app) && /app-filter-min/.test(app) && /app-filter-max/.test(app) && /app-filter-delivery/.test(app) && /app-sort/.test(app) && /Menor preço/.test(app) && /Menor distância/.test(app) && /Resultados no mapa/.test(app));
check("Fluxo sem reserva e indisponibilidade imediata", !["app/reservation","app/reservation-rules","app/reservation-cancel","app/reservation-cancelled","app/reservation-expired"].some((route)=>routes.has(route)) && !/function appReservation/.test(app) && /anúncio ficará indisponível imediatamente/.test(app) && /id="proposal-accept" href="#\/app\/payment"/.test(app));

check("Notificacoes filtraveis e estados completos", /function setupNotifications/.test(app) && /data-notification-filter="negotiation"/.test(app) && /data-notification-filter="payment"/.test(app) && /data-notification-filter="delivery"/.test(app) && /data-notification-filter="system"/.test(app) && /notification-unread-only/.test(app) && /data-notification-read/.test(app) && /notification-read-all/.test(app) && /notification-empty/.test(app));
check("Preferencias completas de notificacao", routes.has("app/notification-settings") && /function appNotificationSettings/.test(app) && /function setupNotificationSettings/.test(app) && /channel-push/.test(app) && /channel-email/.test(app) && /channel-sms/.test(app) && /topic-negotiation/.test(app) && /topic-payment/.test(app) && /topic-delivery/.test(app) && /topic-security/.test(app) && /quiet-hours-enabled/.test(app) && /Restaurar padr.o/.test(app));
check("Estados completos e navegaveis de componentes", routes.has("site/component-states") && /function siteComponentStates/.test(app) && /function setupComponentStates/.test(app) && /data-state-group="buttons"/.test(app) && /data-state-group="inputs"/.test(app) && /data-state-group="cards"/.test(app) && /data-state-group="feedback"/.test(app) && /data-preview-state="loading"/.test(app) && /data-preview-state="success"/.test(app) && /data-preview-state="error"/.test(app) && /data-preview-state="empty"/.test(app) && /Foco vis.vel/.test(app));
check("Componentes avancados completos e navegaveis", routes.has("site/advanced-components") && /advanced-components\.js/.test(html) && /function siteAdvancedComponents/.test(advanced) && /function setupAdvancedComponents/.test(advanced) && /advanced-date/.test(advanced) && /advanced-upload/.test(advanced) && /advanced-accordion/.test(advanced) && /tooltip-control/.test(advanced) && /advanced-table-search/.test(advanced) && /data-sort-column/.test(advanced) && /advanced-page-size/.test(advanced));

const failed = checks.filter((item) => item.status === "FAIL");
console.table(checks);
console.log(`\nResultado: ${checks.length - failed.length}/${checks.length} verificações aprovadas.`);
if (failed.length) process.exitCode = 1;
