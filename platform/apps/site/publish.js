import { notify } from "/packages/ui/notify.js";
import "/packages/ui/iconography.js";
import { geocodeLocation, publishListing, uploadListingMedia, readListingPhoto } from "/packages/contracts/marketplace-ui.js";
import { catalogOptions, DIAPER_CATEGORIES, modelsForCategory } from "/packages/contracts/diaper-catalog.js";
import "/apps/site/home.js";
import { mountDonationInstitutionPicker } from "/packages/contracts/donation-institution-picker.js";
import { publicationText, renderPublicationReview } from "/packages/contracts/publication-review.js";
import { parsePrice } from "/packages/contracts/commercial-rules.js";
import { validatePublicationDraft, parsePublicationRegion, renderPublicationIssues } from "/packages/contracts/publication-validation.js";
import { approximatePublicationLocation } from "/packages/contracts/publication-draft-assets.js";
import { mountPublicationPhoto } from "/packages/contracts/publication-draft-assets.js";
import { readSitePublicationDraft, saveSitePublicationDraft, clearSitePublicationDraft } from "/packages/contracts/site-publication-draft.js";
import { preparePublicationAttempt, publicationAttemptFailed, pendingPublicationSource } from "/packages/contracts/publication-attempt.js";

const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function setupSitePublish(){
  const content=document.getElementById('site-publish-content');
  if(!content)return;
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()});
  const draft=document.getElementById('site-publish-draft');if(draft)draft.textContent='Rascunho apenas nesta sessão';
  const guidance=document.querySelector('.publish-guidance > p');if(guidance)guidance.textContent='Preencha cada etapa. Os dados ainda não publicados permanecem somente nesta aba e podem ser perdidos ao sair.';
  const labels=['Tipo de negociação','Produto','Fotos','Condição','Preço','Entrega','Localização','Revisão'];
  const data={type:'Venda',category:'infant',title:'',brand:'Pampers',model:'Confort Sec',size:'M',quantity:'',condition:'sealed',openPackageAttested:false,price:'',delivery:'Retirada no local',location:'',expiry:''};
  const listingDraft=()=>({...data,...parsePublicationRegion(data.location),kind:({Venda:'sale',Troca:'exchange',Doação:'donation'})[data.type],packageCondition:data.condition,priceCents:parsePrice(data.price),description:data.condition==='sealed'?'Pacote fechado e lacrado.':'Pacote aberto para doação, com unidades sem uso.'});
  const resumed=readSitePublicationDraft(sessionStorage);if(resumed)Object.assign(data,resumed.data);
  let step=resumed?.step||1;
  let photoReady=Boolean(resumed?.mediaKey);
  let uploading=false,submitting=false,completed=false,photoPreview=null;
  window.addEventListener('pagehide',()=>{if(photoPreview)URL.revokeObjectURL(photoPreview)});
  const mediaKeys=resumed?.mediaKey?[resumed.mediaKey]:[];
  let restoredPhoto=null,pageActive=true;
  const persist=()=>{try{saveSitePublicationDraft(sessionStorage,{data,mediaKey:mediaKeys[0]||null,step})}catch{if(draft)draft.textContent='Não foi possível salvar o rascunho nesta aba'}};
  window.addEventListener('pagehide',()=>{pageActive=false;restoredPhoto?.dispose();institutionPicker?.dispose();if(!completed)persist()});
  let institutionPicker=null;
  const selectChoice=(selector,key)=>{
    content.querySelectorAll(selector).forEach(button=>button.addEventListener('click',()=>{
      content.querySelectorAll(selector).forEach(item=>item.classList.remove('active'));
      button.classList.add('active');
      data[key]=button.dataset.value;
      if(key==='type'&&data.type!=='Doação'){data.condition='sealed';data.openPackageAttested=false;data.institutionId=null;data.institutionName=null}
      persist();if(key==='condition')draw();
    }));
  };
  const syncInputs=()=>content.querySelectorAll('[data-publish-field]').forEach(input=>input.addEventListener('input',()=>{data[input.dataset.publishField]=input.value;persist()}));
  const body=()=>{
    if(step===1)return `<div class="publish-step-head"><span class="step-number">1</span><div><h2>Qual é o tipo do anúncio?</h2><p>Escolha como deseja disponibilizar as fraldas.</p></div></div><div class="publish-choice-grid"><button class="publish-choice active" data-publish-type data-value="Venda"><span>▣</span><strong>Venda</strong><small>Receba pelas suas fraldas</small></button><button class="publish-choice" data-publish-type data-value="Troca"><span>⇄</span><strong>Troca</strong><small>Troque por outro tamanho ou marca</small></button><button class="publish-choice" data-publish-type data-value="Doação"><span>♡</span><strong>Doação</strong><small>Doe para uma instituição habilitada</small></button></div>`;
    if(step===2)return `<div class="publish-step-head"><span class="step-number">2</span><div><h2>Descreva a fralda descartável</h2><p>O FraldaCycle aceita somente fraldas infantis e para piscina.</p></div></div><div class="form-grid"><label class="field"><span>Categoria</span><select id="site-diaper-category" data-publish-field="category">${DIAPER_CATEGORIES.map(item=>`<option value="${item.value}"${item.value===data.category?' selected':''}>${item.label}</option>`).join('')}</select></label><label class="field"><span>Modelo vendido no Brasil</span><select id="site-diaper-model" data-publish-field="model">${catalogOptions(data.category,data.model)}</select></label><label class="field full"><span>Título do anúncio</span><input data-publish-field="title" value="${escapeHtml(data.title)}"></label><label class="field"><span>Tamanho</span><select data-publish-field="size"><option>RN</option><option>P</option><option selected>M</option><option>G</option><option>XG</option><option>XXG</option><option>XXXG</option></select></label><label class="field"><span>Quantidade de unidades</span><input data-publish-field="quantity" value="${escapeHtml(data.quantity)}" inputmode="numeric"></label></div>`;
    if(step===3)return `<div class="publish-step-head"><span class="step-number">3</span><div><h2>Adicione uma foto nítida</h2><p>A foto real do produto é obrigatória.</p></div></div><div class="site-upload ${photoReady?'ready':''}">${photoPreview?`<img src="${escapeHtml(photoPreview)}" alt="Prévia local da foto selecionada">`:''}<div><strong>${photoReady?'Foto enviada':'Escolha a foto do produto'}</strong><p>O processamento será conferido antes de enviar o anúncio para revisão.</p><button class="button secondary" id="site-add-photo" type="button">${photoReady?'Trocar foto':'Adicionar foto'}</button></div></div><p class="field-error" id="site-photo-error"></p>`;
    if(step===4){const openAllowed=data.type==='Doação';return `<div class="publish-step-head"><span class="step-number">4</span><div><h2>Informe a condição do pacote</h2><p>Venda e troca exigem pacote fechado. Pacote aberto é exclusivo para doação.</p></div></div><div class="publish-choice-grid"><button class="publish-choice ${data.condition==='sealed'?'active':''}" data-publish-condition data-value="sealed"><strong>Fechado e lacrado</strong><small>Obrigatório para venda e troca</small></button>${openAllowed?`<button class="publish-choice ${data.condition==='open'?'active':''}" data-publish-condition data-value="open"><strong>Pacote aberto para doação</strong><small>Todas as unidades devem estar sem uso</small></button>`:''}</div>${openAllowed&&data.condition==='open'?`<label class="terms"><input id="site-open-attestation" type="checkbox" ${data.openPackageAttested?'checked':''}><span>Confirmo que as unidades estão sem uso, limpas, secas, íntegras e corretamente armazenadas.</span></label>`:''}<label class="field full"><span>Validade</span><input type="month" data-publish-field="expiry" value="${escapeHtml(data.expiry)}"></label>`;}
    if(step===5)return `<div class="publish-step-head"><span class="step-number">5</span><div><h2>Defina o valor</h2><p>Use um preço justo e transparente.</p></div></div><label class="field price-field"><span>Preço</span><div class="price-input"><b>R$</b><input data-publish-field="price" value="${escapeHtml(data.price)}" inputmode="decimal"></div></label><div class="notice"><strong>Splits aprovados:</strong> Venda 8% · Troca 5% total (2,5% por parte) · Doação sem taxa.</div>`;
    if(step===6)return `<div class="publish-step-head"><span class="step-number">6</span><div><h2>Como será a entrega?</h2><p>Escolha sua preferência. A entrega será confirmada na negociação.</p></div></div><div class="publish-choice-grid"><button class="publish-choice active" data-publish-delivery data-value="Retirada no local"><strong>Retirada no local</strong><small>Combine um ponto seguro</small></button><button class="publish-choice" data-publish-delivery data-value="Entrega por parceiro"><strong>Entrega por parceiro</strong><small>Frete sujeito à cotação</small></button><button class="publish-choice" data-publish-delivery data-value="Correios"><strong>Correios</strong><small>PAC ou SEDEX rastreado</small></button></div>`;
    if(step===7)return `<div class="publish-step-head"><span class="step-number">7</span><div><h2>Defina a localização</h2><p>Mostramos apenas uma posição aproximada antes da negociação.</p></div></div><label class="field full"><span>Bairro, cidade e estado</span><input data-publish-field="location" placeholder="Bairro, Cidade - UF" value="${escapeHtml(data.location)}"></label><div class="publish-location-map"><span class="map-pin">●</span><strong>${escapeHtml(data.location)||'Região ainda não informada'}</strong><small>Informe somente bairro, cidade e estado</small></div>`;
    return '<section aria-label="Resumo do anúncio"></section>';
  };
  const draw=()=>{
    restoredPhoto?.dispose();restoredPhoto=null;
    institutionPicker?.dispose();institutionPicker=null;
    document.getElementById('site-publish-subtitle').textContent=`Etapa ${step} de 8 · ${labels[step-1]}`;
    document.querySelectorAll('[data-site-publish-step]').forEach((button,index)=>{button.classList.toggle('active',index+1===step);button.classList.toggle('done',index+1<step)});
    content.dataset.step=step;
    content.innerHTML=`${body()}<div class="publish-actions"><button class="button secondary" id="site-publish-back" type="button" ${step===1?'disabled':''}>Voltar</button><button class="button primary" id="site-publish-next" type="button">${step===8?'Enviar para revisão':'Continuar'}</button></div>`;
    syncInputs();
    if(step===4&&data.type==='Doação'){
      const host=document.createElement('section');content.querySelector('.publish-actions').before(host);
      institutionPicker=mountDonationInstitutionPicker(host,{
        selectedId:data.institutionId,getCondition:()=>data.condition,
        onChange:item=>{data.institutionId=item?.id||null;data.institutionName=item?.public_name||null;persist()},
      });
    }
    if(step===8){
      const summary=document.createElement('section');
      for(const child of [...content.children])if(!child.classList.contains('publish-actions'))child.remove();
      content.querySelector('.publish-actions').before(summary);
      renderPublicationReview(summary,listingDraft(),{photoPreview,hasPhoto:photoReady});
      const pending=pendingPublicationSource(sessionStorage,'fc.sitePublishAttempt');
      if(pending){const restore=document.createElement('button');restore.type='button';restore.className='button secondary';restore.textContent='Retomar os dados do envio pendente';restore.addEventListener('click',()=>{Object.assign(data,pending.draft);mediaKeys.splice(0,mediaKeys.length,...pending.mediaKeys);photoReady=Boolean(mediaKeys.length);if(photoPreview)URL.revokeObjectURL(photoPreview);photoPreview=null;step=8;draw()});summary.append(restore);}
    }
    content.querySelectorAll('[data-publish-type]').forEach(button=>button.classList.toggle('active',button.dataset.value===data.type));
    content.querySelectorAll('[data-publish-delivery]').forEach(button=>button.classList.toggle('active',button.dataset.value===data.delivery));
    const size=content.querySelector('[data-publish-field="size"]');if(size)size.value=data.size;
    selectChoice('[data-publish-type]','type');
    selectChoice('[data-publish-condition]','condition');
    selectChoice('[data-publish-delivery]','delivery');
    const category=document.getElementById('site-diaper-category');const model=document.getElementById('site-diaper-model');
    category?.addEventListener('change',()=>{data.category=category.value;const first=modelsForCategory(data.category)[0];data.brand=first.brand;data.model=first.model;draw()});
    model?.addEventListener('change',()=>{data.model=model.value;data.brand=model.selectedOptions[0]?.dataset.brand||'';persist()});
    document.getElementById('site-open-attestation')?.addEventListener('change',event=>{data.openPackageAttested=event.target.checked;persist()});
    if((step===3||step===8)&&photoReady&&!photoPreview){
      const host=document.createElement('div');content.querySelector('.publish-actions').before(host);restoredPhoto=mountPublicationPhoto(host,mediaKeys[0],readListingPhoto);
    }
    const photo=document.getElementById('site-add-photo');
    if(photo)photo.addEventListener('click',()=>{
      const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';
      input.addEventListener('change',async()=>{
        const file=input.files?.[0];if(!file)return;
        if(uploading||submitting)return;
        uploading=true;photo.disabled=true;photo.textContent='Enviando...';
        try{const key=await uploadListingMedia(file);if(!pageActive)return;saveSitePublicationDraft(sessionStorage,{data,mediaKey:key,step});mediaKeys.splice(0,mediaKeys.length,key);photoReady=true;if(photoPreview)URL.revokeObjectURL(photoPreview);photoPreview=URL.createObjectURL(file);notify('Foto enviada. O processamento será conferido ao enviar o anúncio.')}
        catch(error){if(pageActive)notify(error.status===401?'Entre na sua conta para enviar fotos.':error.message)}
        finally{uploading=false;if(pageActive)draw()}
      });input.click();
    });
    document.getElementById('site-publish-back').addEventListener('click',()=>{if(!uploading&&!submitting&&step>1){step--;draw()}});
    document.getElementById('site-publish-next').addEventListener('click',async()=>{
      if(uploading||submitting)return;
      if(step===4&&data.type==='Doação'&&!institutionPicker?.validate()){notify('Escolha uma instituição habilitada que aceite a condição do pacote.');return}
      if(step===2&&(data.title.trim().length<5||!/^\d+$/.test(data.quantity)||Number(data.quantity)<1)){notify('Informe o título e uma quantidade válida.');return}
      if(step===4&&!data.expiry){notify('Informe a validade do produto.');return}
      if(step===5&&data.type==='Venda'&&parsePrice(data.price)===null){notify('Informe um preço válido.');return}
      if(step===7&&!data.location.trim()){notify('Informe bairro, cidade e estado.');return}
      if(step===3&&!photoReady){document.getElementById('site-photo-error').textContent='Adicione pelo menos uma foto para continuar.';return}
      if(step===4&&data.condition==='open'&&!data.openPackageAttested){notify('Confirme as condições sanitárias do pacote aberto.');return}
      if(step<8){step++;draw();document.getElementById('site-publish-content').scrollIntoView({behavior:'smooth',block:'start'});return}
      const issues=validatePublicationDraft(listingDraft(),{mediaKeys,surface:'site'});
      if(issues.length){
        let host=content.querySelector('#publication-issues');if(!host){host=document.createElement('section');host.id='publication-issues';content.querySelector('.publish-actions').before(host)}
        renderPublicationIssues(host,issues,{surface:'site',onNavigate:target=>{step=target;draw()}});notify(issues[0].message);return;
      }
      if(!photoReady||!mediaKeys.length){notify('Adicione uma foto do produto antes de enviar para revisão.');step=3;draw();return}
      if(data.type==='Doação'&&!data.institutionId){notify('Escolha a instituição destinatária.');step=4;draw();return}
      submitting=true;
      const submit=document.getElementById('site-publish-next');submit.disabled=true;submit.textContent='Enviando para revisão...';
      document.getElementById('site-publish-back').disabled=true;
      try {
        const kind = { Venda: 'sale', Troca: 'exchange', Doação: 'donation' }[data.type];
        const numericPrice = parsePrice(data.price);
        const text=publicationText(listingDraft());
        const payload=await preparePublicationAttempt(sessionStorage,'fc.sitePublishAttempt',{draft:listingDraft(),mediaKeys},async()=>{
        const location = await geocodeLocation(data.location);
        const resolved=location?approximatePublicationLocation(location):{...parsePublicationRegion(data.location),latitude:null,longitude:null};
        const locationIssue=validatePublicationDraft({...listingDraft(),...resolved},{mediaKeys,surface:'site'}).find(issue=>issue.step===7);
        if(locationIssue)throw new Error(locationIssue.message);
        return {
          title:text.title,
          description:text.description,
          category: data.category,
          brand: data.brand,
          model: data.model,
          packageCondition: data.condition,
          openPackageAttested: data.openPackageAttested,
          size: data.size,
          quantity: Number(data.quantity),
          kind,
          institutionId:kind==='donation'?data.institutionId:null,
          priceCents: kind === 'sale' ? numericPrice : null,
          city: resolved.city,
          state: resolved.state,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          mediaKeys,
        };
        });
        const result=await publishListing(payload);
        sessionStorage.setItem('fc.lastListingId', result.listing.id);
        clearSitePublicationDraft(sessionStorage);restoredPhoto?.dispose();restoredPhoto=null;
        sessionStorage.removeItem('fc.sitePublishAttempt');
        const isActive = result.listing.status === 'published';
        content.innerHTML=`<div class="ui-state ${isActive?'success-state':'warning-state'}"><div class="state-icon ${isActive?'success':'warning'}">${isActive?'✓':'!'}</div><span class="eyebrow">${isActive?'Anúncio publicado':'Anúncio recebido'}</span><h2>${isActive?'Seu produto já está disponível':'Seu anúncio aguarda análise'}</h2><p>${isActive?'As famílias próximas poderão encontrar e negociar este anúncio.':'A publicação ainda não está visível. Consulte o resultado em Meus anúncios.'}</p><article class="review-product compact"><img src="${escapeHtml(photoPreview||'')}" alt="Foto selecionada do produto"><div><h3>${escapeHtml(data.title)}</h3>${kind==='sale'?`<strong>R$ ${escapeHtml(data.price)}</strong>`:''}</div></article><div class="publish-actions action-pair"><a class="button secondary" href="/site/home">Ir para o início</a><a class="button primary" href="/app/profile-ads">Acompanhar meus anúncios</a></div></div>`;
        document.getElementById('site-publish-title').textContent=isActive?'Publicação concluída':'Publicação em análise';
        document.getElementById('site-publish-subtitle').textContent=isActive?'Anúncio ativo':'Aguardando análise';
        document.querySelectorAll('[data-site-publish-step]').forEach(button=>button.classList.add('done'));
        completed=true;
        notify(isActive?'Anúncio publicado com sucesso':'Anúncio enviado para revisão');
      } catch (error) {
        publicationAttemptFailed(sessionStorage,'fc.sitePublishAttempt',error);
        notify(error.status === 401 ? 'Entre na sua conta para publicar.' : error.message);
        if (error.status === 401) location.pathname = '/site/login';
        return;
      } finally {submitting=false;if(!completed)draw()}
    });
    if(!completed)persist();
  };
  document.querySelectorAll('[data-site-publish-step]').forEach(button=>button.addEventListener('click',()=>{if(uploading||submitting||completed)return;const target=Number(button.dataset.sitePublishStep);if(target<=step){step=target;draw()}}));
  draw();
}

setupSitePublish();

