import { geocodeLocation, publishListing, uploadListingMedia } from "/packages/contracts/marketplace-ui.js";
import { catalogOptions, DIAPER_CATEGORIES, modelsForCategory } from "/packages/contracts/diaper-catalog.js";
import "/apps/site/home.js";

function notify(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function setupSitePublish(){
  const content=document.getElementById('site-publish-content');
  if(!content)return;
  const labels=['Tipo de negociação','Produto','Fotos','Condição','Preço','Entrega','Localização','Revisão'];
  const data={type:'Venda',category:'infant',title:'Pampers Confort Sec M - 50 unidades',brand:'Pampers',model:'Confort Sec',size:'M',quantity:'50',condition:'sealed',openPackageAttested:false,price:'42,00',delivery:'Retirada no local',location:'Bairro Castelo, Belo Horizonte - MG'};
  let step=1;
  let photoReady=false;
  const mediaKeys=[];
  const selectChoice=(selector,key)=>{
    content.querySelectorAll(selector).forEach(button=>button.addEventListener('click',()=>{
      content.querySelectorAll(selector).forEach(item=>item.classList.remove('active'));
      button.classList.add('active');
      data[key]=button.dataset.value;
      if(key==='type'&&data.type!=='Doação'){data.condition='sealed';data.openPackageAttested=false}
      if(key==='condition')draw();
    }));
  };
  const syncInputs=()=>content.querySelectorAll('[data-publish-field]').forEach(input=>input.addEventListener('input',()=>{data[input.dataset.publishField]=input.value}));
  const body=()=>{
    if(step===1)return `<div class="publish-step-head"><span class="step-number">1</span><div><h2>Qual é o tipo do anúncio?</h2><p>Escolha como deseja disponibilizar as fraldas.</p></div></div><div class="publish-choice-grid"><button class="publish-choice active" data-publish-type data-value="Venda"><span>▣</span><strong>Venda</strong><small>Receba pelas suas fraldas</small></button><button class="publish-choice" data-publish-type data-value="Troca"><span>⇄</span><strong>Troca</strong><small>Troque por outro tamanho ou marca</small></button><button class="publish-choice" data-publish-type data-value="Doação"><span>♡</span><strong>Doação</strong><small>Doe para uma família</small></button></div>`;
    if(step===2)return `<div class="publish-step-head"><span class="step-number">2</span><div><h2>Descreva a fralda descartável</h2><p>O FraldaCycle aceita somente fraldas infantis e para piscina.</p></div></div><div class="form-grid"><label class="field"><span>Categoria</span><select id="site-diaper-category" data-publish-field="category">${DIAPER_CATEGORIES.map(item=>`<option value="${item.value}"${item.value===data.category?' selected':''}>${item.label}</option>`).join('')}</select></label><label class="field"><span>Modelo vendido no Brasil</span><select id="site-diaper-model" data-publish-field="model">${catalogOptions(data.category,data.model)}</select></label><label class="field full"><span>Título do anúncio</span><input data-publish-field="title" value="${data.title}"></label><label class="field"><span>Tamanho</span><select data-publish-field="size"><option>RN</option><option>P</option><option selected>M</option><option>G</option><option>XG</option><option>XXG</option><option>XXXG</option></select></label><label class="field"><span>Quantidade de unidades</span><input data-publish-field="quantity" value="${data.quantity}" inputmode="numeric"></label></div>`;
    if(step===3)return `<div class="publish-step-head"><span class="step-number">3</span><div><h2>Adicione fotos nítidas</h2><p>A primeira imagem será a capa do anúncio.</p></div></div><div class="site-upload ${photoReady?'ready':''}"><img src="/source/assets/approved/pampers-approved.png" alt="Pacote Pampers aprovado pelo cliente"><div><strong>${photoReady?'Foto adicionada':'Imagem do produto'}</strong><p>Use a fotografia aprovada presente no acervo.</p><button class="button secondary" id="site-add-photo" type="button">${photoReady?'Trocar foto':'Adicionar foto'}</button></div></div><p class="field-error" id="site-photo-error"></p>`;
    if(step===4){const openAllowed=data.type==='Doação';return `<div class="publish-step-head"><span class="step-number">4</span><div><h2>Informe a condição do pacote</h2><p>Venda e troca exigem pacote fechado. Pacote aberto é exclusivo para doação.</p></div></div><div class="publish-choice-grid"><button class="publish-choice ${data.condition==='sealed'?'active':''}" data-publish-condition data-value="sealed"><strong>Fechado e lacrado</strong><small>Obrigatório para venda e troca</small></button>${openAllowed?`<button class="publish-choice ${data.condition==='open'?'active':''}" data-publish-condition data-value="open"><strong>Pacote aberto para doação</strong><small>Todas as unidades devem estar sem uso</small></button>`:''}</div>${openAllowed&&data.condition==='open'?`<label class="terms"><input id="site-open-attestation" type="checkbox" ${data.openPackageAttested?'checked':''}><span>Confirmo que as unidades estão sem uso, limpas, secas, íntegras e corretamente armazenadas.</span></label>`:''}<label class="field full"><span>Validade</span><input type="month" value="2026-10"></label>`;}
    if(step===5)return `<div class="publish-step-head"><span class="step-number">5</span><div><h2>Defina o valor</h2><p>Use um preço justo e transparente.</p></div></div><label class="field price-field"><span>Preço</span><div class="price-input"><b>R$</b><input data-publish-field="price" value="${data.price}" inputmode="decimal"></div></label><div class="notice"><strong>Splits aprovados:</strong> Venda 8% · Troca 5% total (2,5% por parte) · Doação sem taxa.</div>`;
    if(step===6)return `<div class="publish-step-head"><span class="step-number">6</span><div><h2>Como será a entrega?</h2><p>Você pode disponibilizar mais de uma opção.</p></div></div><div class="publish-choice-grid"><button class="publish-choice active" data-publish-delivery data-value="Retirada no local"><strong>Retirada no local</strong><small>Combine um ponto seguro</small></button><button class="publish-choice" data-publish-delivery data-value="Entrega por parceiro"><strong>Entrega por parceiro</strong><small>A partir de R$ 8,90</small></button><button class="publish-choice" data-publish-delivery data-value="Correios"><strong>Correios</strong><small>PAC ou SEDEX rastreado</small></button></div>`;
    if(step===7)return `<div class="publish-step-head"><span class="step-number">7</span><div><h2>Defina a localização</h2><p>Mostramos apenas uma posição aproximada antes da negociação.</p></div></div><label class="field full"><span>Bairro, cidade e estado</span><input data-publish-field="location" value="${data.location}"></label><div class="publish-location-map"><span class="map-pin">●</span><strong>Belo Horizonte</strong><small>Localização aproximada protegida</small></div>`;
    return `<div class="publish-step-head"><span class="step-number">8</span><div><h2>Revise seu anúncio</h2><p>Confira as informações antes de publicar.</p></div></div><article class="review-product"><img src="/source/assets/approved/pampers-approved.png" alt=""><div><span class="chip">${data.type}</span><h3>${data.title}</h3>${data.type==='Venda'?`<strong>R$ ${data.price}</strong>`:''}<p>${data.brand} ${data.model} · ${data.condition==='sealed'?'Pacote fechado':'Pacote aberto para doação'} · ${data.delivery}</p><small>${data.location}</small></div></article><div class="notice">Ao publicar, você confirma as informações e as regras de higiene. Pacote aberto somente pode ser doado.</div>`;
  };
  const draw=()=>{
    document.getElementById('site-publish-subtitle').textContent=`Etapa ${step} de 8 · ${labels[step-1]}`;
    document.querySelectorAll('[data-site-publish-step]').forEach((button,index)=>{button.classList.toggle('active',index+1===step);button.classList.toggle('done',index+1<step)});
    content.dataset.step=step;
    content.innerHTML=`${body()}<div class="publish-actions"><button class="button secondary" id="site-publish-back" type="button" ${step===1?'disabled':''}>Voltar</button><button class="button primary" id="site-publish-next" type="button">${step===8?'Publicar anúncio':'Continuar'}</button></div>`;
    syncInputs();
    selectChoice('[data-publish-type]','type');
    selectChoice('[data-publish-condition]','condition');
    selectChoice('[data-publish-delivery]','delivery');
    const category=document.getElementById('site-diaper-category');const model=document.getElementById('site-diaper-model');
    category?.addEventListener('change',()=>{data.category=category.value;const first=modelsForCategory(data.category)[0];data.brand=first.brand;data.model=first.model;draw()});
    model?.addEventListener('change',()=>{data.model=model.value;data.brand=model.selectedOptions[0]?.dataset.brand||''});
    document.getElementById('site-open-attestation')?.addEventListener('change',event=>{data.openPackageAttested=event.target.checked});
    const photo=document.getElementById('site-add-photo');
    if(photo)photo.addEventListener('click',()=>{
      const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';
      input.addEventListener('change',async()=>{
        const file=input.files?.[0];if(!file)return;
        photo.disabled=true;photo.textContent='Enviando...';
        try{const key=await uploadListingMedia(file);mediaKeys.splice(0,mediaKeys.length,key);photoReady=true;draw();notify('Foto adicionada ao anúncio')}
        catch(error){if(error.code==='provider_not_configured'){photoReady=true;draw();notify('Foto aprovada mantida até configurar o storage');return}photo.disabled=false;photo.textContent='Adicionar foto';notify(error.status===401?'Entre na sua conta para enviar fotos.':error.message)}
      });input.click();
    });
    document.getElementById('site-publish-back').addEventListener('click',()=>{if(step>1){step--;draw()}});
    document.getElementById('site-publish-next').addEventListener('click',async()=>{
      if(step===3&&!photoReady){document.getElementById('site-photo-error').textContent='Adicione pelo menos uma foto para continuar.';return}
      if(step===4&&data.condition==='open'&&!data.openPackageAttested){notify('Confirme as condições sanitárias do pacote aberto.');return}
      if(step<8){step++;draw();document.getElementById('site-publish-content').scrollIntoView({behavior:'smooth',block:'start'});return}
      try {
        const kind = { Venda: 'sale', Troca: 'exchange', Doação: 'donation' }[data.type];
        const numericPrice = Math.round(Number(String(data.price).replace('.', '').replace(',', '.')) * 100);
        const location = await geocodeLocation(data.location);
        const result = await publishListing({
          title: data.title,
          description: `${data.condition==='sealed'?'Pacote fechado e lacrado':'Pacote aberto para doação, com unidades sem uso'}. ${data.delivery}. ${data.location}.`,
          category: data.category,
          brand: data.brand,
          model: data.model,
          packageCondition: data.condition,
          openPackageAttested: data.openPackageAttested,
          size: data.size,
          quantity: Number(data.quantity),
          kind,
          priceCents: kind === 'sale' ? numericPrice : null,
          city: location?.city ?? data.location.split(',')[1]?.trim() ?? null,
          state: location?.state ?? data.location.match(/-\s*([A-Z]{2})$/)?.[1] ?? null,
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          mediaKeys,
        });
        sessionStorage.setItem('fc.lastListingId', result.listing.id);
      } catch (error) {
        notify(error.status === 401 ? 'Entre na sua conta para publicar.' : error.message);
        if (error.status === 401) location.pathname = '/site/login';
        return;
      }
      content.innerHTML=`<div class="ui-state success-state"><div class="state-icon success">✓</div><span class="eyebrow">Anúncio publicado</span><h2>Seu produto já está disponível</h2><p>As famílias próximas poderão encontrar e negociar este anúncio.</p><article class="review-product compact"><img src="/source/assets/approved/pampers-approved.png" alt=""><div><h3>${data.title}</h3><strong>R$ ${data.price}</strong></div></article><div class="publish-actions action-pair"><a class="button secondary" href="/site/home">Ir para o início</a><a class="button primary" href="/site/detail" id="site-published-detail">Ver anúncio</a></div></div>`;
      document.getElementById('site-publish-title').textContent='Publicação concluída';
      document.getElementById('site-publish-subtitle').textContent='Anúncio ativo';
      document.querySelectorAll('[data-site-publish-step]').forEach(button=>button.classList.add('done'));
      const publishedDetail=document.getElementById('site-published-detail');if(publishedDetail)publishedDetail.href=`/site/detail?id=${sessionStorage.getItem('fc.lastListingId')}`;
      notify('Anúncio publicado com sucesso');
    });
  };
  document.querySelectorAll('[data-site-publish-step]').forEach(button=>button.addEventListener('click',()=>{const target=Number(button.dataset.sitePublishStep);if(target<=step){step=target;draw()}}));
  draw();
}

setupSitePublish();
