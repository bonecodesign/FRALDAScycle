const footer = document.querySelector('footer.site-footer');

if (footer && footer.dataset.unified !== 'true') {
  const pageNote = footer.querySelector('small')?.textContent.trim()
    || 'Ambiente pré-operacional; recursos e integrações indisponíveis são identificados.';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '/apps/site/footer.css';
  document.head.append(stylesheet);

  footer.classList.add('site-home-footer');
  footer.dataset.unified = 'true';
  footer.innerHTML = `
    <div class="site-footer-brand">
      <a class="brand footer-brand" href="/site/home" aria-label="FraldaCycle, início">
        <img class="brand-logo-approved" src="/source/assets/approved/logo-approved.png" alt="FraldaCycle">
      </a>
      <p>Economia circular para famílias e para o planeta.</p>
      <small class="site-footer-page-note">${escapeHtml(pageNote)}</small>
    </div>
    <div class="site-footer-groups">
      <nav class="site-footer-group" aria-label="Plataforma">
        <strong>Plataforma</strong>
        <a href="/site/search">Marketplace</a>
        <a href="/site/home#categorias">Categorias</a>
        <a href="/site/publish">Anunciar</a>
        <a href="/site/search?kind=donation">Doações</a>
      </nav>
      <nav class="site-footer-group" aria-label="Institucional">
        <strong>Institucional</strong>
        <a href="/site/home#como-funciona">Como funciona</a>
        <a href="/site/impact">Impacto</a>
        <a href="/site/help#canais">Contato</a>
      </nav>
      <nav class="site-footer-group" aria-label="Suporte">
        <strong>Suporte</strong>
        <a href="/site/help">Ajuda</a>
        <a href="/app/safety">Segurança</a>
        <a href="/site/help#politicas">Termos e privacidade (em revisão)</a>
        <a href="/app/privacy">Solicitações de privacidade</a>
      </nav>
      <nav class="site-footer-group" aria-label="Conta">
        <strong>Conta</strong>
        <a href="/site/login">Entrar</a>
        <a href="/app/register">Cadastro</a>
      </nav>
    </div>
    <small class="site-footer-disclosure">Ambiente pré-operacional; capacidades indisponíveis são identificadas.</small>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

import('/packages/ui/cookie-banner.js').then(({setupCookieBanner})=>setupCookieBanner());
