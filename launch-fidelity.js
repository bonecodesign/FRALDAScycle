(() => {
  const markup = `
    <section class="dashboard-grid launch-closing-grid" data-launch-fidelity>
      <article class="panel">
        <div class="section-head"><div><span class="eyebrow">Go-live</span><h2>Marketing e comunicação</h2><p>Canais e materiais preparados para apresentar a plataforma.</p></div></div>
        <div class="status-list">
          <span><b>Site e blog</b><em>Publicado</em></span><span><b>Redes sociais</b><em>Ativo</em></span>
          <span><b>E-mail marketing</b><em>Enviado</em></span><span><b>Press release</b><em>Divulgado</em></span>
          <span><b>Materiais promocionais</b><em>Disponível</em></span>
        </div>
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="eyebrow">Retrospectiva</span><h2>Lições aprendidas</h2><p>Conhecimento consolidado para a evolução contínua.</p></div></div>
        <ul class="check-list"><li>Automação de testes acelerou a qualidade.</li><li>Comunicação frequente aumentou o alinhamento.</li><li>Dados limpos são essenciais para confiança.</li><li>Foco no usuário gera engajamento.</li><li>Impacto positivo motiva time e comunidade.</li></ul>
        <button class="btn secondary" id="launch-lessons">Ver relatório completo</button>
      </article>
    </section>
    <section class="panel launch-final-status" data-launch-fidelity>
      <div class="launch-final-mark">✓</div>
      <div><span class="eyebrow">Status final do produto</span><h2>Site e aplicativo prontos para operação acompanhada</h2><p>Experiência responsiva e navegável, operação monitorada, segurança em camadas, suporte ativo e evolução contínua.</p></div>
      <div class="status-list compact"><span><b>Web + App</b><em>Disponíveis</em></span><span><b>Monitoramento</b><em>Ativo</em></span><span><b>Suporte</b><em>Preparado</em></span></div>
    </section>`;

  function enhanceLaunch() {
    const target = document.getElementById("launch-detail");
    if (!target || document.querySelector("[data-launch-fidelity]")) return;
    target.insertAdjacentHTML("beforebegin", markup);
    document.getElementById("launch-lessons")?.addEventListener("click", () => {
      const toast = document.getElementById("toast");
      if (toast) { toast.textContent = "Relatório de lições aprendidas preparado"; toast.classList.add("show"); }
    });
  }

  new MutationObserver(enhanceLaunch).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => window.setTimeout(enhanceLaunch));
  enhanceLaunch();
})();
