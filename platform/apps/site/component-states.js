import "/apps/site/home.js";

function notify(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function setupComponentStates(){
  const page=document.querySelector('.component-states-page');if(!page)return;
  const tabs=[...page.querySelectorAll('[data-state-group]')];
  const panels=[...page.querySelectorAll('[data-state-panel]')];
  tabs.forEach(tab=>tab.addEventListener('click',()=>{
    tabs.forEach(item=>item.classList.toggle('active',item===tab));
    panels.forEach(panel=>panel.hidden=panel.dataset.statePanel!==tab.dataset.stateGroup);
  }));
  const preview=document.querySelector('#component-state-preview');
  const states={
    loading:`<div class="state-spinner large"></div><h2>Carregando informações</h2><p>Aguarde enquanto preparamos o conteúdo.</p>`,
    success:`<div class="state-icon">✓</div><h2>Tudo pronto!</h2><p>A operação foi realizada com sucesso.</p><button class="button primary">Continuar</button>`,
    error:`<div class="state-icon danger">!</div><h2>Não foi possível concluir</h2><p>Verifique sua conexão e tente novamente.</p><button class="button secondary">Tentar novamente</button>`,
    empty:`<div class="state-icon">⌕</div><h2>Nenhum item encontrado</h2><p>Altere os filtros ou publique o primeiro anúncio.</p><button class="button primary">Publicar anúncio</button>`
  };
  page.querySelectorAll('[data-preview-state]').forEach(button=>button.addEventListener('click',()=>{
    page.querySelectorAll('[data-preview-state]').forEach(item=>item.classList.toggle('active',item===button));
    const state=button.dataset.previewState;
    preview.className=`ui-state ${state}-state`;
    preview.innerHTML=states[state];
  }));
}
setupComponentStates();
