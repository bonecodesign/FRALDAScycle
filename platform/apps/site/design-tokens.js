import "/apps/site/home.js";

function notify(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

const fraldaTokens={
  color:{primary:'#16A34A',primaryDark:'#0F7A3A',secondary:'#2563EB',support:'#7C3AED',warning:'#F59E0B',error:'#EF4444',info:'#06B6D4',neutral:'#64748B',surface:'#F8FAFC',background:'#FFFFFF',text:'#111827'},
  space:{1:4,2:8,3:12,4:16,5:20,6:24,8:32,12:48,16:64,20:80,24:96},
  radius:{sm:4,md:8,lg:12,xl:16,'2xl':24,full:999},
  motion:{fast:150,standard:250,slow:300}
};
function siteDesignTokens(){
  const colors=[['Primária','primary'],['Primária escura','primaryDark'],['Secundária','secondary'],['Apoio','support'],['Atenção','warning'],['Erro','error'],['Informação','info'],['Neutro','neutral'],['Superfície','surface'],['Texto','text']];
  return `<section class="section tokens-page"><span class="eyebrow">Fralda Design Language · Tokens e temas</span><div class="section-head"><div><h1>Tokens e padrões visuais</h1><p>Fonte única para web e aplicativo, com temas claro e escuro.</p></div><div class="theme-actions"><button class="button secondary" id="theme-toggle" aria-pressed="false">◐ Alternar tema</button><button class="button primary" id="tokens-export">Exportar JSON</button></div></div><section class="panel"><div class="section-head"><div><h2>Sistema de cores</h2><p>Tokens semânticos; não use valores diretos nas interfaces.</p></div><span class="badge">Claro e escuro</span></div><div class="token-color-grid">${colors.map(([label,key])=>`<article><i style="--token-color:${fraldaTokens.color[key]}"></i><strong>${label}</strong><code>--color-${key.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`)}</code><small>${fraldaTokens.color[key]}</small></article>`).join('')}</div></section><div class="token-grid"><section class="panel"><h2>Tipografia</h2><div class="type-specimens"><div class="display-token"><span>Aa</span><div><strong>Inter</strong><small>Fonte principal e de interface</small></div></div><p class="type-display">Economia circular que transforma vidas.</p><p class="type-heading">Encontre, economize e transforme</p><p class="type-title">Título de seção</p><p class="type-body">Conectamos famílias e promovemos escolhas sustentáveis.</p><small>Texto auxiliar, legendas e informações complementares.</small></div></section><section class="panel"><h2>Escala tipográfica</h2><div class="token-list"><span><b>Display</b><code>48 / 56 · Bold</code></span><span><b>Headline</b><code>40 / 48 · Bold</code></span><span><b>Title</b><code>32 / 40 · SemiBold</code></span><span><b>Subtitle</b><code>24 / 32 · Medium</code></span><span><b>Body</b><code>16 / 24 · Regular</code></span><span><b>Caption</b><code>14 / 20 · Regular</code></span><span><b>Small</b><code>12 / 16 · Regular</code></span><span><b>Micro</b><code>10 / 14 · Regular</code></span></div></section><section class="panel"><h2>Espaçamento · base 4 px</h2><div class="spacing-tokens">${Object.entries(fraldaTokens.space).map(([key,value])=>`<div><span style="width:${value}px;height:${Math.max(4,value/2)}px"></span><code>space-${key} · ${value}px</code></div>`).join('')}</div></section><section class="panel"><h2>Raios</h2><div class="radius-tokens">${Object.entries(fraldaTokens.radius).map(([key,value])=>`<div style="border-radius:${value}px"><code>${key}<br>${value}px</code></div>`).join('')}</div></section><section class="panel"><h2>Sombras</h2><div class="shadow-tokens"><article class="shadow-sm">SM</article><article class="shadow-md">MD</article><article class="shadow-lg">LG</article><article class="shadow-xl">XL</article><article class="shadow-focus">Foco</article></div></section><section class="panel"><h2>Animações e transições</h2><div class="motion-tokens"><button data-motion="fast"><i></i><strong>Rápida</strong><small>150 ms</small></button><button data-motion="standard"><i></i><strong>Padrão</strong><small>250 ms</small></button><button data-motion="slow"><i></i><strong>Lenta</strong><small>300 ms</small></button></div><p class="muted">Ative cada amostra para visualizar o movimento.</p></section></div><section class="panel"><div class="section-head"><div><h2>Grid e breakpoints</h2><p>Mobile-first, responsivo por padrão.</p></div></div><div class="breakpoint-grid"><article><span class="device phone-device"></span><strong>Mobile</strong><small>&lt; 576 px · 4 colunas · gutter 16</small></article><article><span class="device tablet-device"></span><strong>Tablet</strong><small>≥ 576 px · 8 colunas · gutter 24</small></article><article><span class="device desktop-device"></span><strong>Desktop</strong><small>≥ 992 px · 12 colunas · gutter 24</small></article><article><span class="device wide-device"></span><strong>Wide</strong><small>≥ 1440 px · 12 colunas · gutter 32</small></article></div><div class="twelve-grid">${Array.from({length:12},(_,i)=>`<i>${i+1}</i>`).join('')}</div></section><section class="panel token-code"><div class="section-head"><div><h2>Implementação</h2><p>Tokens prontos para CSS e aplicações.</p></div><button class="button secondary" id="tokens-copy">Copiar exemplo</button></div><pre id="tokens-code"><code>:root {
  --color-primary: #16A34A;
  --color-secondary: #2563EB;
  --color-background: #FFFFFF;
  --color-text: #111827;
  --space-4: 16px;
  --radius-md: 8px;
  --motion-standard: 250ms;
}</code></pre></section><div class="principles-strip"><span>Consistência visual</span><span>Acessibilidade AA</span><span>Escalabilidade</span><span>Modo claro/escuro</span><span>Documentação viva</span></div></section>`;
}
function applyStoredTheme(){
  const stored=localStorage.getItem('fraldacycle-theme')||'light';
  document.documentElement.dataset.theme=stored;
}
function setupDesignTokens(){
  const page=document.querySelector('.tokens-page');if(!page)return;
  const toggle=page.querySelector('#theme-toggle');
  const sync=()=>{const dark=document.documentElement.dataset.theme==='dark';toggle.setAttribute('aria-pressed',String(dark));toggle.textContent=dark?'☀ Usar tema claro':'◐ Usar tema escuro'};
  toggle.addEventListener('click',()=>{const mode=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=mode;localStorage.setItem('fraldacycle-theme',mode);sync()});sync();
  page.querySelector('#tokens-copy').addEventListener('click',async()=>{await navigator.clipboard?.writeText(page.querySelector('#tokens-code').innerText);notify('Exemplo de tokens copiado')});
  page.querySelector('#tokens-export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(fraldaTokens,null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='fraldacycle-tokens.json';link.click();URL.revokeObjectURL(link.href);notify('Tokens exportados em JSON')});
  page.querySelectorAll('[data-motion]').forEach(button=>button.addEventListener('click',()=>{button.classList.remove('playing');requestAnimationFrame(()=>button.classList.add('playing'))}));
}
applyStoredTheme();

setupDesignTokens();
