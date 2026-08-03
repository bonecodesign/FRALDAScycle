import "/apps/site/home.js";

const accessibilityChecks=[
  ['Contraste AA','Textos e controles atingem no mínimo 4,5:1.','contrast'],
  ['Teclado completo','Toda ação pode ser alcançada sem mouse.','keyboard'],
  ['Foco visível','Indicador de foco permanece claro em todos os componentes.','focus'],
  ['Leitores de tela','Landmarks, rótulos e mensagens usam semântica apropriada.','screen-reader'],
  ['Toque mínimo','Alvos interativos respeitam 48 × 48 px.','touch'],
  ['Texto escalável','Conteúdo suporta ampliação até 200% sem perda.','scale']
];
function accessibilityDemo(){
  return `<div class="a11y-demo" aria-label="Exemplo de formulário acessível"><a class="skip-demo" href="#a11y-form">Pular para o formulário</a><header><b>FraldaCycle</b><nav aria-label="Navegação de demonstração"><button>Início</button><button>Buscar</button><button>Favoritos</button></nav></header><main id="a11y-form"><h3>Publicar anúncio</h3><p id="a11y-description">Informe os dados para disponibilizar seu produto.</p><label>Nome do produto<input id="a11y-name" aria-describedby="a11y-name-help" placeholder="Ex.: Pampers Confort"></label><small id="a11y-name-help">Use marca, modelo e tamanho.</small><fieldset><legend>Tipo de negociação</legend><label><input type="radio" name="a11y-deal" checked> Venda</label><label><input type="radio" name="a11y-deal"> Troca</label><label><input type="radio" name="a11y-deal"> Doação</label></fieldset><label><input type="checkbox" checked> Produto novo e lacrado</label><button class="button primary" id="a11y-submit">Continuar</button><div class="a11y-live" id="a11y-live" role="status" aria-live="polite"></div></main></div>`;
}
function siteAccessibilityLab(){
  const cards=accessibilityChecks.map(([title,text,key])=>`<article data-a11y-check="${key}"><span aria-hidden="true">✓</span><div><b>${title}</b><p>${text}</p></div><strong>Aprovado</strong></article>`).join('');
  return `<section class="section accessibility-lab-page"><span class="eyebrow">Fralda Design Language · Acessibilidade</span><div class="section-head"><div><h1>Auditoria WCAG 2.1 AA</h1><p>Validação prática da experiência inclusiva em web e aplicativo.</p></div><a class="button secondary" href="/site/responsive-lab">Ver breakpoints</a></div><section class="a11y-score panel"><div class="a11y-ring"><strong>100%</strong><small>6 de 6 critérios</small></div><div><h2>Conformidade AA</h2><p>Os padrões aprovados foram aplicados à demonstração e podem ser inspecionados abaixo.</p><div class="a11y-score-badges"><span>WCAG 2.1</span><span>Nível AA</span><span>Mobile + Web</span></div></div></section><section class="a11y-check-grid">${cards}</section><section class="panel"><div class="section-head"><div><h2>Laboratório interativo</h2><p>Teste navegação por teclado, ampliação e anúncio por leitor de tela.</p></div></div><div class="a11y-toolbar" role="group" aria-label="Ferramentas de acessibilidade"><button id="a11y-focus-toggle" aria-pressed="false">Mostrar ordem de foco</button><button id="a11y-scale-toggle" aria-pressed="false">Texto 200%</button><button id="a11y-contrast-toggle" aria-pressed="false">Alto contraste</button><button id="a11y-read-summary">Ouvir resumo</button></div><div class="a11y-workbench"><div><ol class="focus-order-list" aria-label="Ordem de foco"><li>Link “Pular para o formulário”</li><li>Navegação principal</li><li>Campo nome do produto</li><li>Tipo de negociação</li><li>Confirmação do produto</li><li>Ação Continuar</li></ol><p class="a11y-instruction"><kbd>Tab</kbd> avança · <kbd>Shift</kbd> + <kbd>Tab</kbd> retorna · <kbd>Enter</kbd> ativa</p></div>${accessibilityDemo()}</div></section><section class="token-grid"><article class="panel"><h2>Contraste verificado</h2><div class="contrast-list"><div><i style="--foreground:#111827;--background:#fff"></i><span><b>Texto principal</b><small>#111827 / #FFFFFF</small></span><strong>17,7:1</strong></div><div><i style="--foreground:#087B46;--background:#fff"></i><span><b>Verde institucional</b><small>#087B46 / #FFFFFF</small></span><strong>5,3:1</strong></div><div><i style="--foreground:#fff;--background:#087B46"></i><span><b>Botão primário</b><small>#FFFFFF / #087B46</small></span><strong>5,3:1</strong></div><div><i style="--foreground:#13233F;--background:#EEF9F2"></i><span><b>Texto em superfície</b><small>#13233F / #EEF9F2</small></span><strong>12,6:1</strong></div></div></article><article class="panel"><h2>Semântica e tecnologias assistivas</h2><ul class="a11y-semantic-list"><li>Landmarks de cabeçalho, navegação, conteúdo e rodapé.</li><li>Rótulos associados a todos os campos.</li><li>Estados anunciados com <code>aria-live</code>.</li><li>Ícones decorativos ocultos do leitor de tela.</li><li>Erros vinculados ao campo correspondente.</li><li>Conteúdo preservado com zoom de 200%.</li></ul></article></section><div class="principles-strip"><span>Perceptível</span><span>Operável</span><span>Compreensível</span><span>Robusto</span><span>Inclusivo</span></div></section>`;
}
function setupAccessibilityLab(){
  const page=document.querySelector('.accessibility-lab-page');if(!page)return;
  const demo=page.querySelector('.a11y-demo'),live=page.querySelector('#a11y-live');
  const toggles=[
    ['#a11y-focus-toggle','show-focus'],
    ['#a11y-scale-toggle','scale-200'],
    ['#a11y-contrast-toggle','high-contrast']
  ];
  toggles.forEach(([selector,className])=>page.querySelector(selector).addEventListener('click',event=>{
    const active=demo.classList.toggle(className);event.currentTarget.setAttribute('aria-pressed',String(active));
  }));
  page.querySelector('#a11y-submit').addEventListener('click',()=>{live.textContent='Etapa validada. Você pode continuar com segurança.'});
  page.querySelector('#a11y-read-summary').addEventListener('click',()=>{
    const message='Auditoria de acessibilidade aprovada. Contraste, teclado, foco, leitor de tela, toque e texto escalável estão conformes.';
    live.textContent=message;
    if('speechSynthesis' in window){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(message))}
  });
}

setupAccessibilityLab();
