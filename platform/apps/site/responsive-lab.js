import "/apps/site/home.js";

const responsivePresets={
  mobile:{label:'Mobile',width:390,columns:4,gutter:16},
  tablet:{label:'Tablet',width:768,columns:8,gutter:24},
  desktop:{label:'Desktop',width:1024,columns:12,gutter:24},
  wide:{label:'Wide',width:1440,columns:12,gutter:32}
};
function responsivePreview(){
  return `<div class="responsive-demo"><header><b>FraldaCycle</b><nav><span>Início</span><span>Buscar</span><span>Publicar</span><span>Favoritos</span><span>Perfil</span></nav></header><div class="responsive-demo-body"><aside><strong>Filtros</strong><span>Tipo de anúncio</span><span>Distância</span><span>Marca</span><span>Tamanho</span></aside><main><div class="responsive-search">Buscar fraldas, marcas e tamanhos…</div><div class="responsive-results"><article><i></i><b>Pampers Confort</b><small>R$ 45,00 · 0,8 km</small></article><article><i></i><b>Huggies Supreme</b><small>R$ 40,00 · 1,2 km</small></article><article><i></i><b>Babysec Ultra</b><small>R$ 38,00 · 1,6 km</small></article></div><div class="responsive-map"><b>Mapa dos resultados</b><span>●</span><span>●</span><span>●</span></div></main></div><footer><span>Início</span><span>Buscar</span><b>＋</b><span>Chat</span><span>Perfil</span></footer></div>`;
}
function siteResponsiveLab(){
  const controls=Object.entries(responsivePresets).map(([key,preset])=>`<button data-responsive-preset="${key}" aria-pressed="${key==='desktop'}"><span class="device ${key}-device"></span><b>${preset.label}</b><small>${preset.width}px · ${preset.columns} col. · gutter ${preset.gutter}</small></button>`).join('');
  return `<section class="section responsive-lab-page"><span class="eyebrow">Fralda Design Language · Responsividade</span><div class="section-head"><div><h1>Laboratório de breakpoints</h1><p>Validação navegável dos quatro tamanhos oficiais do acervo.</p></div><a class="button secondary" href="/site/design-tokens">Ver tokens</a></div><section class="panel"><div class="responsive-controls">${controls}</div><div class="responsive-status" role="status"><strong id="responsive-name">Desktop · 1024 px</strong><span id="responsive-spec">12 colunas · gutter 24 px</span></div><div class="responsive-stage"><div id="responsive-viewport" class="responsive-viewport is-desktop" style="--preview-width:1024px;--preview-columns:12;--preview-gutter:24px">${responsivePreview()}</div></div></section><section class="panel responsive-rules"><h2>Comportamento validado</h2><div><article><b>Mobile</b><p>Navegação inferior fixa, filtros empilhados, uma coluna e ações com toque mínimo de 48 px.</p></article><article><b>Tablet</b><p>Oito colunas, cards em duas colunas e filtros em painel compacto.</p></article><article><b>Desktop</b><p>Doze colunas, filtros laterais, três cards e mapa após os resultados.</p></article><article><b>Wide</b><p>Container centralizado, doze colunas, respiro ampliado e densidade controlada.</p></article></div></section><div class="principles-strip"><span>Mobile-first</span><span>Conteúdo fluido</span><span>Toque 48×48</span><span>Sem perda de conteúdo</span><span>Mapa responsivo</span></div></section>`;
}
function setupResponsiveLab(){
  const page=document.querySelector('.responsive-lab-page');if(!page)return;
  const viewport=page.querySelector('#responsive-viewport'),name=page.querySelector('#responsive-name'),spec=page.querySelector('#responsive-spec');
  page.querySelectorAll('[data-responsive-preset]').forEach(button=>button.addEventListener('click',()=>{
    const key=button.dataset.responsivePreset,preset=responsivePresets[key];
    page.querySelectorAll('[data-responsive-preset]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    viewport.className=`responsive-viewport is-${key}`;
    viewport.style.setProperty('--preview-width',`${preset.width}px`);
    viewport.style.setProperty('--preview-columns',preset.columns);
    viewport.style.setProperty('--preview-gutter',`${preset.gutter}px`);
    name.textContent=`${preset.label} · ${preset.width} px`;
    spec.textContent=`${preset.columns} colunas · gutter ${preset.gutter} px`;
  }));
}

setupResponsiveLab();
