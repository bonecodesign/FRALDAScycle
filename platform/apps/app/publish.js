import { notify } from "/packages/ui/notify.js";
import "/packages/ui/iconography.js";
import { publishListing, uploadListingMedia } from "/packages/contracts/marketplace-ui.js";
import { DIAPER_CATEGORIES, catalogOptions } from "/packages/contracts/diaper-catalog.js";

import { parsePrice, listingPrice, saleSplit } from "/packages/contracts/commercial-rules.js";

const DRAFT_KEY = "fc.publishDraft";
function readDraft(){try{return JSON.parse(sessionStorage.getItem(DRAFT_KEY))||{}}catch{return {}}}
function saveDraft(patch){const next={...readDraft(),...patch};sessionStorage.setItem(DRAFT_KEY,JSON.stringify(next));return next}

function setupPublishValidation(){
  const content=document.getElementById('publish-content');
  if(!content)return;
  const step=Number(content.dataset.publishStep);const next=document.getElementById('publish-next');const error=content.querySelector('.publish-error');
  const draft=readDraft();
  if(step===1){const choices=[...content.querySelectorAll('input[name="kind"]')];const selected=choices.find(item=>item.value===(draft.kind||'sale'))||choices[0];if(selected)selected.checked=true;choices.forEach(item=>item.addEventListener('change',()=>saveDraft({kind:item.value,packageCondition:'sealed',openPackageAttested:false})))}
  if(step===2){const category=document.getElementById('app-diaper-category');const model=document.getElementById('app-diaper-model');const size=document.getElementById('app-diaper-size');const quantity=document.getElementById('app-diaper-quantity');const selectedCategory=draft.category||'infant';category.innerHTML=DIAPER_CATEGORIES.map(item=>`<option value="${item.value}">${item.label}</option>`).join('');category.value=selectedCategory;const fillModels=()=>{const previous=readDraft().model;model.innerHTML=catalogOptions(category.value,previous);if(!model.value)model.selectedIndex=0;const selected=model.selectedOptions[0];saveDraft({category:category.value,brand:selected?.dataset.brand,model:model.value})};fillModels();category.addEventListener('change',fillModels);model.addEventListener('change',()=>saveDraft({brand:model.selectedOptions[0]?.dataset.brand,model:model.value}));size.value=draft.size||'M';size.addEventListener('change',()=>saveDraft({size:size.value}));quantity.value=draft.quantity||'50';quantity.addEventListener('input',()=>saveDraft({quantity:quantity.value}))}
  if(step===4){const kind=draft.kind||'sale';const openOption=document.getElementById('app-open-package-option');const attestation=document.getElementById('app-open-package-attestation');openOption.hidden=kind!=='donation';const conditions=[...content.querySelectorAll('input[name="condition"]')];const selected=kind==='donation'&&draft.packageCondition==='open'?'open':'sealed';const selectedInput=conditions.find(item=>item.value===selected);if(selectedInput)selectedInput.checked=true;const syncCondition=()=>{const value=conditions.find(item=>item.checked)?.value||'sealed';attestation.hidden=value!=='open';saveDraft({packageCondition:value,openPackageAttested:value==='open'&&attestation.querySelector('input').checked})};conditions.forEach(item=>item.addEventListener('change',syncCondition));attestation.querySelector('input').checked=Boolean(draft.openPackageAttested);attestation.querySelector('input').addEventListener('change',syncCondition);syncCondition();const description=content.querySelector('textarea');description.value=draft.description||'';description.addEventListener('input',()=>saveDraft({description:description.value}))}
  if(step===5){
    const price=content.querySelector('.proposal-value');
    const sale=(draft.kind||'sale')==='sale';
    price.disabled=!sale;
    price.value=sale?(draft.priceCents?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(draft.priceCents/100):''):'';
    price.placeholder=sale?'Informe o valor':'Sem preço de venda';
    price.addEventListener('input',()=>saveDraft({priceCents:parsePrice(price.value)}));
  }
  if(step===8){
    const price=content.querySelector('.price');
    try{
      const value=listingPrice(draft);
      const format=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
      if(value===null)price.textContent=draft.kind==='donation'?'Doação':'Troca';
      else{
        const split=saleSplit(value);
        price.textContent=`${format(value)} · Comissão: ${format(split.platformCents)} · Você recebe: ${format(split.sellerCents)} antes da tarifa do processador`;
      }
    }catch(problem){error.textContent=problem.message;document.querySelector('#publish-submit').disabled=true;}
  }
  const upload=content.querySelector('.upload-zone');
  if(step===3&&upload){
    let busy=false,preview=null;
    const choosePhoto=()=>{
      if(busy)return;
      const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';
      input.addEventListener('change',async()=>{
        const file=input.files?.[0];if(!file)return;busy=true;
        const button=upload.querySelector('button');button.disabled=true;button.textContent='Enviando...';
        try{
          const key=await uploadListingMedia(file);sessionStorage.setItem('fc.publishMediaKey',key);
          if(preview)URL.revokeObjectURL(preview);preview=URL.createObjectURL(file);
          const image=document.createElement('img');image.src=preview;image.alt='Prévia local da foto selecionada';
          const label=document.createElement('strong');label.textContent='Foto gravada, aguardando revisão do anúncio';
          const replace=document.createElement('button');replace.type='button';replace.className='button secondary';replace.textContent='Trocar foto';replace.addEventListener('click',choosePhoto);
          upload.replaceChildren(image,label,replace);upload.dataset.ready='true';upload.classList.add('ready');error.textContent='';
        }catch(problem){button.disabled=false;button.textContent='Escolher foto';error.textContent=problem.message;notify(problem.message);}
        finally{busy=false;}
      });input.click();
    };
    const button=upload.querySelector('button');button.type='button';button.addEventListener('click',choosePhoto);
  }
  if(!next)return;
  const fail=message=>{error.textContent=message;content.querySelector('.publish-step')?.classList.add('has-error')};
  next.addEventListener('click',()=>{let message='';if(step===2&&(!document.getElementById('app-diaper-model')?.value||!/^\d+$/.test(document.getElementById('app-diaper-quantity')?.value)))message='Escolha o modelo e informe a quantidade de unidades.';if(step===3&&content.querySelector('.upload-zone')?.dataset.ready!=='true')message='Adicione pelo menos uma foto do produto.';if(step===4){const condition=content.querySelector('input[name="condition"]:checked')?.value;const attested=document.querySelector('#app-open-package-attestation input')?.checked;if(!content.querySelector('.form-group input')?.value.trim()||!content.querySelector('textarea')?.value.trim())message='Informe a validade e a descrição do produto.';else if(condition==='open'&&!attested)message='Confirme as condições sanitárias do pacote aberto.'}if(step===5&&(readDraft().kind||'sale')==='sale'&&parsePrice(content.querySelector('.proposal-value')?.value)===null)message='Informe o valor do anúncio.';if(step===7){const inputs=content.querySelectorAll('.form-group input');if((inputs[0]?.value.replace(/\D/g,'').length||0)!==8||!inputs[1]?.value.trim())message='Informe um CEP válido e o bairro.'}if(message)return fail(message);error.textContent='';next.disabled=true;next.innerHTML='<span class="inline-spinner"></span> Salvando...';setTimeout(()=>{location.pathname=`/app/publish-${step+1}`},400)})
}


setupPublishValidation();

const publish = document.querySelector("#publish-submit");
const publishContent = document.querySelector("#publish-content");
publish?.addEventListener("click", async () => {
  publish.disabled = true;
  publish.innerHTML = '<span class="inline-spinner"></span> Publicando...';
  try {
    const draft = readDraft();
    const result = await publishListing({
      title: `${draft.brand||'Pampers'} ${draft.model||'Confort Sec'} ${draft.size||'M'} · ${draft.quantity||50} unidades`,
      description: draft.description?.trim() || (draft.packageCondition==='open' ? "Pacote aberto para doação, com unidades sem uso, limpas, secas e íntegras." : "Pacote fechado, lacrado e pronto para uma negociação segura."),
      category: draft.category||"infant", brand: draft.brand||"Pampers", model: draft.model||"Confort Sec",
      packageCondition: draft.packageCondition||"sealed", openPackageAttested:Boolean(draft.openPackageAttested),
      size: draft.size||"M", quantity: Number(draft.quantity)||50, kind: draft.kind||"sale",
      priceCents: listingPrice(draft),
      mediaKeys: sessionStorage.getItem("fc.publishMediaKey") ? [sessionStorage.getItem("fc.publishMediaKey")] : [],
    });
    sessionStorage.setItem("fc.lastListingId", result.listing.id);
    sessionStorage.removeItem(DRAFT_KEY);
    const state=document.createElement('section');state.className='ui-state success-state';
    const heading=document.createElement('h1');heading.textContent=result.listing.status==='review'?'Anúncio aguardando moderação':'Anúncio publicado com sucesso';
    const explanation=document.createElement('p');explanation.textContent=result.listing.status==='review'?'Fotos precisam de revisão antes da publicação. Nenhuma revisão automática ou disponibilidade foi presumida.':'Seu anúncio foi gravado. Consulte os dados na sua conta.';
    const link=document.createElement('a');link.href='/app/premium';link.textContent='Gerenciar meus anúncios';state.append(heading,explanation,link);publishContent.replaceChildren(state);
    notify(heading.textContent);
  } catch (error) {
    notify(error.status === 401 ? "Entre na sua conta para publicar." : error.message);
    publish.disabled = false;
    publish.textContent = "Publicar anúncio";
    if (error.status === 401) location.pathname = "/app/login";
  }
});


