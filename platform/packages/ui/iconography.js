const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  heart: '<path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  package: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 8 9 5 9-5M3 8v9l9 5 9-5V8M12 13v9"/>',
  exchange: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18M12 8H8.5A2.5 2.5 0 1 1 11 5.5ZM12 8h3.5A2.5 2.5 0 1 0 13 5.5Z"/>',
  cart: '<path d="M3 4h2l2.4 11h10.8l2-7H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  moon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z"/>',
  document: '<path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h5M9 12h6M9 16h6"/>',
};

export function fcIcon(name, className = '') {
  const body = ICONS[name] || ICONS.grid;
  return `<svg class="fc-icon ${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

const byText = (text, fallback = 'grid') => {
  const value = text.toLowerCase();
  const rules = [
    [/in[ií]cio|vis[aã]o geral|dashboard/, 'home'], [/buscar|pesquisa/, 'search'],
    [/favorit/, 'heart'], [/publicar|adicionar|novo/, 'plus'], [/chat|mensag/, 'message'],
    [/perfil|usu[aá]rio|cliente|institui/, 'user'], [/notifica|alerta/, 'bell'],
    [/produto|an[uú]ncio|cat[aá]logo|estoque/, 'package'], [/troca|transa[cç]/, 'exchange'],
    [/doa[cç]/, 'gift'], [/pedido|pagamento|finance|carteira/, 'cart'],
    [/relat[oó]rio|indicador|impacto|intelig/, 'chart'], [/seguran|auditoria|permiss/, 'shield'],
    [/config|governan|integra/, 'settings'], [/document|jur[ií]dico|ajuda/, 'document'],
  ];
  return rules.find(([pattern]) => pattern.test(value))?.[1] || fallback;
};

function iconifyLink(link, name, preserveText = true) {
  if (link.querySelector('.fc-icon')) return;
  const originalLabel = link.textContent.trim();
  const label = originalLabel
    .replace(/^\d+\s*[·.-]\s*/, '')
    .replace(/^[⌂⌕♡▣⌖↔◐♙↗]+\s*/, '')
    .trim() || originalLabel;
  link.innerHTML = `${fcIcon(name)}${preserveText ? `<span>${label}</span>` : ''}`;
  if (!link.getAttribute('aria-label')) link.setAttribute('aria-label', label);
}

function setupAppIcons(root) {
  root.dataset.iconified = 'true';
  const navNames = ['home', 'search', 'plus', 'message', 'user'];
  document.querySelectorAll('.phone-nav a').forEach((link, index) => {
    const span = link.querySelector('span');
    if (span && !span.querySelector('.fc-icon')) span.innerHTML = fcIcon(navNames[index] || byText(link.textContent));
  });
  document.querySelectorAll('.app-menu a').forEach((link) => iconifyLink(link, byText(link.textContent)));
  document.querySelectorAll('.quick-actions a, .quick-actions button').forEach((link) => iconifyLink(link, byText(link.textContent)));
  document.querySelectorAll('.favorite, [aria-label*="Favorit"], [title*="Favorit"]').forEach((control) => {
    if (!control.querySelector('.fc-icon')) control.innerHTML = fcIcon('heart');
  });
  document.querySelectorAll('.notification-button').forEach((control) => {
    if (!control.querySelector('.fc-icon')) control.innerHTML = fcIcon('bell');
  });
}

function setupAdminIcons(root) {
  root.dataset.iconified = 'true';
  document.querySelectorAll('.admin-sidebar a').forEach((link) => iconifyLink(link, byText(link.textContent)));
  document.querySelectorAll('.admin-shortcut-grid a').forEach((link) => {
    const mark = link.querySelector(':scope > span');
    if (mark) mark.innerHTML = fcIcon(byText(link.textContent), 'admin-nav-icon');
  });
}

function setupSiteIcons() {
  const theme = document.querySelector('#theme-toggle span');
  if (theme && !theme.querySelector('.fc-icon')) theme.innerHTML = fcIcon('moon');
  document.querySelectorAll('.favorite, [aria-label*="Favorit"], [title*="Favorit"]').forEach((control) => {
    if (!control.querySelector('.fc-icon')) control.innerHTML = fcIcon('heart');
  });
}

const root = document.querySelector('main[data-surface]');
if (root?.dataset.surface === 'app') setupAppIcons(root);
else if (root?.dataset.surface === 'admin') setupAdminIcons(root);
else setupSiteIcons();
