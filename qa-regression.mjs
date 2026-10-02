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
check("Experiência própria do entregador", ["courier/home","courier/job","courier/route","courier/proof","courier/history","courier/account"].every((route)=>routes.has(route)) && /function courierHome/.test(app) && /function courierProof/.test(app) && /function courierAccount/.test(app) && /courier-proof-form/.test(app) && /courier-photo-add/.test(app) && /(Histórico|Ganhos) e repasses/.test(app));
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

check("Contraproposta, recusa e evidencias", routes.has("app/negotiation-evidence") && /function appNegotiationEvidence/.test(app) && /proposal-reject/.test(app) && /Evid.ncias da negocia..o/.test(app) && /Proposta original/.test(app) && /Contraproposta recebida/.test(app) && (/Protocolo #NEG/.test(app)||/Protocolo<\/small><strong>#NEG/.test(app)) && /evidence-export/.test(app));
check("Favoritos web com estados completos", routes.has("site/favorites") && /function siteFavorites/.test(app) && /function setupSiteFavorites/.test(app) && /Carregando seus favoritos/.test(app) && /Nenhum favorito salvo/.test(app) && /data-remove-site-favorite/.test(app) && /site-favorites-clear/.test(app) && /#\/site\/favorites/.test(html));
check("Favoritos do app com buscas salvas e estados vazios", routes.has("app/favorites") && /function appFavorites/.test(app) && /function setupAppFavorites/.test(app) && /data-app-favorites-tab="items"/.test(app) && /data-app-favorites-tab="searches"/.test(app) && /data-favorite-item/.test(app) && /data-saved-search-open/.test(app) && /favorite-items-empty/.test(app) && /saved-search-empty/.test(app));
check("Configurações do app com segurança e privacidade", routes.has("app/settings") && /function appSettings/.test(app) && /function setupAppSettings/.test(app) && /settings-push/.test(app) && /settings-email/.test(app) && /data-settings-panel="blocked"/.test(app) && /data-settings-panel="privacy"/.test(app) && /data-settings-panel="security"/.test(app) && /settings-export-data/.test(app) && /settings-close-sessions/.test(app));
check("Ajuda do app com busca e abertura de atendimento", routes.has("app/help") && /function appHelp/.test(app) && /function setupAppHelp/.test(app) && /help-search/.test(app) && /data-help-topic="payment"/.test(app) && /data-help-topic="delivery"/.test(app) && /data-help-item/.test(app) && /help-support-form/.test(app) && /SUP-2841/.test(app));
check("Endereços do app com cadastro, edição e remoção", routes.has("app/addresses") && /function appAddresses/.test(app) && /function setupAppAddresses/.test(app) && /data-address-card/.test(app) && /address-add/.test(app) && /address-form/.test(app) && /address-primary/.test(app) && /address-delete-confirm/.test(app) && /Seu endereço exato só é compartilhado/.test(app));
check("Histórico do app com filtros e evidências", routes.has("app/profile-history") && /function appProfileHistory/.test(app) && /function setupAppHistory/.test(app) && /data-history-filter="active"/.test(app) && /data-history-filter="completed"/.test(app) && /data-history-filter="closed"/.test(app) && /data-history-item/.test(app) && /history-detail-grid/.test(app) && /Mensagens, propostas e comprovantes permanecem vinculados/.test(app));
check("Avaliações do app com distribuição e filtros", routes.has("app/profile-reviews") && /function appProfileReviews/.test(app) && /function setupAppReviews/.test(app) && /rating-distribution/.test(app) && /data-review-filter="5"/.test(app) && /data-review-filter="4"/.test(app) && /data-review-filter="3"/.test(app) && /review-sort/.test(app) && /data-review-entry/.test(app) && /Negociação verificada/.test(app));
check("Impacto individual com período e metodologia", routes.has("app/my-impact") && /function appMyImpact/.test(app) && /function setupAppImpact/.test(app) && /impact-period/.test(app) && /impact-packages/.test(app) && /impact-families/.test(app) && /impact-donations/.test(app) && /impact-goal-progress/.test(app) && /Como calculamos estes resultados/.test(app) && /estimativas educativas/.test(app));
check("Perfil do app como hub de conta", routes.has("app/profile") && /function appProfile/.test(app) && /function setupProfileHub/.test(app) && /profile-quick-grid/.test(app) && /profile-trust-row/.test(app) && /profile-edit-form/.test(app) && /profile-display-name/.test(app) && /Conta e preferências/.test(app) && /Atividade e reputação/.test(app));
check("Carteira como painel financeiro protegido", routes.has("app/wallet") && /function setupWallet/.test(app) && /wallet-visibility/.test(app) && /wallet-summary/.test(app) && /wallet-action-grid/.test(app) && /data-wallet-method/.test(app) && /data-wallet-amount/.test(app) && /wallet-result-count/.test(app) && /wallet-empty/.test(app) && /Em custódia/.test(app));
check("Pagamento com resumo e custódia explícitos", routes.has("app/payment") && /payment-progress/.test(app) && /payment-order-card/.test(app) && /payment-breakdown/.test(app) && /payment-protection/.test(app) && /Confirmar pagamento de R\$ 51,00/.test(app) && /Como funciona a compra protegida/.test(app));
check("Rastreamento de entrega com confiança e ações", routes.has("app/delivery") && /delivery-hero/.test(app) && /delivery-live-row/.test(app) && /delivery-quick-actions/.test(app) && /Rastreamento ao vivo/.test(app) && /Pagamento protegido durante todo o trajeto/.test(app));
check("Confirmação e avaliação pós-entrega", routes.has("app/delivery-confirm") && routes.has("app/delivery-rate") && /confirmation-checklist/.test(app) && /confirmation-protection/.test(app) && /delivery-confirm-receipt/.test(app) && /rating-subject/.test(app) && /rating-privacy/.test(app));
check("Sucesso do pagamento com custódia e próximos passos", routes.has("app/payment-success") && /payment-success-card/.test(app) && /custody-timeline/.test(app) && /payment-success-notice/.test(app) && /payment-success-back/.test(app) && /PIX-2387-9841-1123/.test(app));
check("Chat de negociação com contexto e proteção", routes.has("app/chat") && /chat-deal-card/.test(app) && /chat-trust-strip/.test(app) && /chat-quick-replies/.test(app) && /chat-context-note/.test(app) && /Proteção ativa/.test(app));
check("Proposta com modalidade, privacidade e intenção claras", routes.has("app/proposal") && /proposal-product-card/.test(app) && /proposal-explainer/.test(app) && /proposal-kind/.test(app) && /proposal-privacy/.test(app) && /sem cobrança agora/.test(app));
check("Contraproposta com decisão e comparação de valores", routes.has("app/proposal-received") && /counteroffer-card/.test(app) && /price-compare/.test(app) && /counteroffer-note/.test(app) && /decision-actions/.test(app) && /Aceitar R\$ 42,00 e pagar/.test(app));
check("Evidências da negociação com protocolo e filtros", routes.has("app/negotiation-evidence") && /evidence-protocol/.test(app) && /evidence-filter/.test(app) && /Registro preservado/.test(app) && /O anúncio permanece disponível até aceite/.test(app) && /evidence-protections/.test(app));
check("Painel do entregador com ganhos, disponibilidade e privacidade", routes.has("courier/home") && /courier-earnings-card/.test(app) && /courier-safety-note/.test(app) && /Tempo em rota/.test(app) && /Endereço completo só aparece/.test(app));
check("Aceite de rota com esforço, ganho e proteção", routes.has("courier/job") && /courier-offer-card/.test(app) && /courier-offer-metrics/.test(app) && /courier-route-summary/.test(app) && /courier-package-note/.test(app) && /Aceitar rota por R\$ 19,00/.test(app));
check("Rota ativa com navegação, ETA e segurança", routes.has("courier/route") && /courier-navigation-card/.test(app) && /courier-next-turn/.test(app) && /courier-route-eta/.test(app) && /courier-route-actions/.test(app) && /interaja com o app somente quando estiver parado/.test(app));
check("Prova de entrega orientada e privada", routes.has("courier/proof") && /courier-proof-progress/.test(app) && /courier-proof-intro/.test(app) && /courier-proof-metadata/.test(app) && /courier-proof-privacy/.test(app) && /evite rostos, documentos/.test(app));
check("Histórico do entregador com repasses rastreáveis", routes.has("courier/history") && /courier-balance-card/.test(app) && /courier-next-payment/.test(app) && /courier-history-filters/.test(app) && /courier-payment-list/.test(app) && /Repasses rastreáveis/.test(app));
check("Perfil público web do vendedor", routes.has("site/seller") && /function siteSeller/.test(app) && /Perfil verificado/.test(app) && /Reputação na comunidade/.test(app) && /Indicadores de confiança/.test(app) && /Anúncios ativos/.test(app) && /#\/site\/seller/.test(app));
check("Publicação web em 8 etapas", routes.has("site/publish") && /function setupSitePublish/.test(app) && /data-site-publish-step/.test(app) && /Splits aprovados/.test(app) && /Adicione pelo menos uma foto/.test(app) && /Anúncio publicado/.test(app) && /site-open-package-attestation/.test(app) && /Pacote aberto somente pode ser doado/.test(app));
check("Estados completos de autenticação", ["app/auth-error", "app/auth-locked", "app/auth-offline"].every((route) => routes.has(route)) && /function appAuthError/.test(app) && /function appAuthLocked/.test(app) && /function appAuthOffline/.test(app) && /Acesso temporariamente bloqueado/.test(app) && /Verificando conexão/.test(app));
check("Estados críticos anteriores aos testes reais", ["app/state-payment-declined", "app/state-session-expired", "app/state-photo-invalid", "app/state-delivery-disputed"].every((route)=>routes.has(route)) && /function appStatePaymentDeclined/.test(app) && /function appStateSessionExpired/.test(app) && /function appStatePhotoInvalid/.test(app) && /function appStateDeliveryDisputed/.test(app) && /O pagamento foi recusado/.test(app) && /Sua sessão expirou/.test(app) && /A foto precisa ser refeita/.test(app) && /A entrega foi contestada/.test(app));
check("Painel administrativo identificado como demonstração sem login", /prototypeAdminAuthenticationEnabled=false/.test(app) && /Modo demonstração/.test(app) && /Painel acessível sem login nesta fase/.test(app) && /Demonstração do fluxo protegido/.test(app));
check("Telemetria UX local sem dados pessoais", /function trackUxEvent/.test(app) && /fc\.prototypeUxEvents/.test(app) && /route_view/.test(app) && /interaction/.test(app) && /slice\(-100\)/.test(app));
check("Mudanças de rota anunciadas para tecnologia assistiva", /id="route-announcer"/.test(html) && /aria-atomic="true"/.test(html) && /Página carregada:/.test(app) && /\.sr-only/.test(css));
check("Busca app com filtros, ordenação e mapa", /app-filter-type/.test(app) && /app-filter-size/.test(app) && /app-filter-brand/.test(app) && /app-filter-distance/.test(app) && /app-filter-min/.test(app) && /app-filter-max/.test(app) && /app-filter-delivery/.test(app) && /app-sort/.test(app) && /Menor preço/.test(app) && /Menor distância/.test(app) && /Resultados no mapa/.test(app));
check("Fluxo sem reserva e indisponibilidade imediata", !["app/reservation","app/reservation-rules","app/reservation-cancel","app/reservation-cancelled","app/reservation-expired"].some((route)=>routes.has(route)) && !/function appReservation/.test(app) && /anúncio ficará indisponível imediatamente/.test(app) && /id="proposal-accept" href="#\/app\/payment"/.test(app));

check("Notificacoes filtraveis e estados completos", /function setupNotifications/.test(app) && /data-notification-filter="negotiation"/.test(app) && /data-notification-filter="payment"/.test(app) && /data-notification-filter="delivery"/.test(app) && /data-notification-filter="system"/.test(app) && /notification-unread-only/.test(app) && /data-notification-read/.test(app) && /notification-read-all/.test(app) && /notification-empty/.test(app));
check("Preferencias completas de notificacao", routes.has("app/notification-settings") && /function appNotificationSettings/.test(app) && /function setupNotificationSettings/.test(app) && /channel-push/.test(app) && /channel-email/.test(app) && /channel-sms/.test(app) && /topic-negotiation/.test(app) && /topic-payment/.test(app) && /topic-delivery/.test(app) && /topic-security/.test(app) && /quiet-hours-enabled/.test(app) && /Restaurar padr.o/.test(app));
check("Estados completos e navegaveis de componentes", routes.has("site/component-states") && /function siteComponentStates/.test(app) && /function setupComponentStates/.test(app) && /data-state-group="buttons"/.test(app) && /data-state-group="inputs"/.test(app) && /data-state-group="cards"/.test(app) && /data-state-group="feedback"/.test(app) && /data-preview-state="loading"/.test(app) && /data-preview-state="success"/.test(app) && /data-preview-state="error"/.test(app) && /data-preview-state="empty"/.test(app) && /Foco vis.vel/.test(app));
check("Componentes avancados completos e navegaveis", routes.has("site/advanced-components") && /advanced-components\.js/.test(html) && /function siteAdvancedComponents/.test(advanced) && /function setupAdvancedComponents/.test(advanced) && /advanced-date/.test(advanced) && /advanced-upload/.test(advanced) && /advanced-accordion/.test(advanced) && /tooltip-control/.test(advanced) && /advanced-table-search/.test(advanced) && /data-sort-column/.test(advanced) && /advanced-page-size/.test(advanced));
check("Iconografia SVG consistente no App", /const appIcons=/.test(app) && /function appIcon/.test(app) && /function setupAppIconography/.test(app) && /new MutationObserver\(scheduleAppIconography\)/.test(app) && /\.phone-nav a,\.app-menu a/.test(app) && /quickIcons=/.test(app));

const failed = checks.filter((item) => item.status === "FAIL");
console.table(checks);
console.log(`\nResultado: ${checks.length - failed.length}/${checks.length} verificações aprovadas.`);
if (failed.length) process.exitCode = 1;
