import { notify } from "/packages/ui/notify.js";
import "/packages/ui/iconography.js";
import { publishListing, uploadListingMedia, geocodeLocation, readListingPhoto } from "/packages/contracts/marketplace-ui.js";
import { DIAPER_CATEGORIES, catalogOptions } from "/packages/contracts/diaper-catalog.js";

import { parsePrice, listingPrice } from "/packages/contracts/commercial-rules.js";
import { mountDonationInstitutionPicker } from "/packages/contracts/donation-institution-picker.js";
import { publicationText, renderPublicationReview } from "/packages/contracts/publication-review.js";
import { approximatePublicationLocation, publicationLocationFields, mountPublicationPhoto } from "/packages/contracts/publication-draft-assets.js";
import { validatePublicationDraft, renderPublicationIssues } from "/packages/contracts/publication-validation.js";
import { mountPublicationUpload } from "/packages/contracts/publication-upload.js";
import { preparePublicationAttempt, publicationAttemptFailed, pendingPublicationSource } from "/packages/contracts/publication-attempt.js";

const DRAFT_KEY = "fc.publishDraft";
let reviewPhoto=null;
function readDraft(){try{const draft=JSON.parse(sessionStorage.getItem(DRAFT_KEY));return draft&&typeof draft==='object'&&!Array.isArray(draft)?draft:{}}catch{return {}}}
function saveDraft(patch){const next={...readDraft(),...patch};sessionStorage.setItem(DRAFT_KEY,JSON.stringify(next));return next}

function setupPublishValidation(){
  const content=document.getElementById('publish-content');
  if(!content)return;
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()});
  const step=Number(content.dataset.publishStep);const next=document.getElementById('publish-next');const error=content.querySelector('.publish-error');
  const draft=readDraft();
  const badge=content.querySelector('.screen-title-row .badge');if(badge)badge.textContent='Rascunho nesta aba';
  let institutionPicker=null;
  if(step===4&&draft.kind==='donation'){
    const host=document.createElement('section');content.querySelector('.publish-step').append(host);
    institutionPicker=mountDonationInstitutionPicker(host,{
      selectedId:draft.institutionId,
      getCondition:()=>content.querySelector('input[name="condition"]:checked')?.value||'sealed',
      onChange:item=>saveDraft({institutionId:item?.id||null,institutionName:item?.public_name||null}),
    });
    content.querySelectorAll('input[name="condition"]').forEach(input=>input.addEventListener('change',()=>institutionPicker.refresh()));
  }
  if(step===1){const choices=[...content.querySelectorAll('input[name="kind"]')];const selected=choices.find(item=>item.value===(draft.kind||'sale'))||choices[0];if(selected){selected.checked=true;saveDraft({kind:selected.value})}choices.forEach(item=>item.addEventListener('change',()=>saveDraft({kind:item.value,packageCondition:'sealed',openPackageAttested:false})))}
  if(step===2){const category=document.getElementById('app-diaper-category');const model=document.getElementById('app-diaper-model');const size=document.getElementById('app-diaper-size');const quantity=document.getElementById('app-diaper-quantity');const selectedCategory=draft.category||'infant';category.innerHTML=DIAPER_CATEGORIES.map(item=>`<option value="${item.value}">${item.label}</option>`).join('');category.value=selectedCategory;const fillModels=()=>{const previous=readDraft().model;model.innerHTML=catalogOptions(category.value,previous);if(!model.value)model.selectedIndex=0;const selected=model.selectedOptions[0];saveDraft({category:category.value,brand:selected?.dataset.brand,model:model.value})};fillModels();category.addEventListener('change',fillModels);model.addEventListener('change',()=>saveDraft({brand:model.selectedOptions[0]?.dataset.brand,model:model.value}));size.value=draft.size||'M';size.addEventListener('change',()=>saveDraft({size:size.value}));quantity.value=draft.quantity??'';quantity.addEventListener('input',()=>saveDraft({quantity:quantity.value}));saveDraft({size:size.value,quantity:quantity.value})}
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
    renderPublicationReview(content.querySelector('.publish-step'),{...draft,location:[draft.neighborhood,draft.city,draft.state].filter(Boolean).join(' — ')},{hasPhoto:Boolean(sessionStorage.getItem('fc.publishMediaKey'))});
    const key=sessionStorage.getItem('fc.publishMediaKey');
    if(key){const host=document.createElement('div');content.querySelector('.publish-step').append(host);reviewPhoto=mountPublicationPhoto(host,key,readListingPhoto);window.addEventListener('pagehide',()=>reviewPhoto?.dispose(),{once:true});}
    document.querySelector('#publish-submit').textContent='Enviar para revisão';
    try{listingPrice(draft)}catch(problem){error.textContent=problem.message;document.querySelector('#publish-submit').disabled=true;}
    const pending=pendingPublicationSource(sessionStorage,'fc.publishAttempt');
    if(pending){const restore=document.createElement('button');restore.type='button';restore.className='button secondary';restore.textContent='Retomar os dados do envio pendente';restore.addEventListener('click',()=>{sessionStorage.setItem(DRAFT_KEY,JSON.stringify(pending.draft));sessionStorage.setItem('fc.publishMediaKey',pending.mediaKey);location.reload()});content.querySelector('.publish-step').append(restore);}
  }
  if(step===4){
    const expiry=content.querySelector('.form-group input');expiry.value=draft.expiry||'';expiry.placeholder='MM/AAAA';expiry.addEventListener('input',()=>saveDraft({expiry:expiry.value.trim()}));
  }
  if(step===6){
    const choices=[...content.querySelectorAll('input[name="delivery"]')];
    choices.forEach(input=>{input.value='Entrega por parceiro';input.checked=true;input.addEventListener('change',()=>saveDraft({delivery:input.value}))});
    saveDraft({delivery:'Entrega por parceiro'});
  }
  if(step===7){
    const inputs=content.querySelectorAll('.form-group input');
    for(const [index,key] of ['postalCode','neighborhood'].entries()){inputs[index].value=draft[key]||'';inputs[index].addEventListener('input',()=>saveDraft({[key]:inputs[index].value.trim()}))}
    const fields={};
    for(const [key,labelText] of [['city','Cidade'],['state','UF']]){
      const label=document.createElement('label');label.className='form-group';label.textContent=labelText;
      const input=document.createElement('input');input.className='input';input.value=draft[key]||'';input.maxLength=key==='city'?120:2;input.required=true;label.append(input);content.querySelector('.publish-step').append(label);fields[key]=input;
      input.addEventListener('input',()=>saveDraft({[key]:key==='state'?input.value.toUpperCase():input.value.trim(),resolvedLocation:null}));
    }
    const map=content.querySelector('.delivery-map');const status=document.createElement('small');status.setAttribute('role','status');status.textContent=draft.city&&draft.state?`${draft.city} — ${draft.state}`:'Consulte o CEP ou informe cidade e UF manualmente.';map?.replaceChildren(status);
    const consult=document.createElement('button');consult.type='button';consult.className='button secondary';consult.textContent='Consultar cidade e UF pelo CEP';content.querySelector('.publish-step').append(consult);
    let generation=0;
    window.addEventListener('pagehide',()=>{generation++},{once:true});
    const invalidate=()=>{generation++;saveDraft({resolvedLocation:null});status.textContent='Região alterada. Consulte novamente ou informe cidade e UF.'};
    [...inputs,...Object.values(fields)].forEach(input=>input.addEventListener('input',invalidate));
    consult.addEventListener('click',async()=>{
      const currentDraft=readDraft(),address=`${currentDraft.postalCode}|${currentDraft.neighborhood}`;
      if((currentDraft.postalCode||'').replace(/\D/g,'').length!==8||!currentDraft.neighborhood){status.textContent='Informe um CEP válido e o bairro.';return}
      const current=++generation;consult.disabled=true;status.textContent='Consultando cidade e UF...';
      try{
        const result=await geocodeLocation(`${currentDraft.postalCode}, ${currentDraft.neighborhood}`);
        if(current!==generation)return;
        if(!result)throw new Error('Consulta de CEP indisponível. Informe cidade e UF manualmente.');
        const location=approximatePublicationLocation(result);fields.city.value=location.city;fields.state.value=location.state;
        saveDraft({...location,resolvedLocation:{...location,address}});status.textContent=`${location.city} — ${location.state}. Posição aproximada.`;
      }catch(problem){if(current===generation){saveDraft({resolvedLocation:null});status.textContent=problem.message}}
      finally{consult.disabled=false}
    });
    next.addEventListener('click',event=>{try{publicationLocationFields(readDraft())}catch(problem){event.stopImmediatePropagation();error.textContent=problem.message}});
  }
  const upload=content.querySelector('.upload-zone');
  if(step===3&&upload){
    const mounted=mountPublicationUpload(upload,{
      storageKey:sessionStorage.getItem('fc.publishMediaKey'),upload:uploadListingMedia,readPhoto:readListingPhoto,
      onUploaded:key=>{sessionStorage.setItem('fc.publishMediaKey',key);error.textContent=''},
      onReady:ready=>{upload.dataset.ready=String(ready);upload.classList.toggle('ready',ready);next.disabled=!ready},
    });
    window.addEventListener('pagehide',()=>mounted.dispose(),{once:true});
  }
  if(!next)return;
  const fail=message=>{error.textContent=message;content.querySelector('.publish-step')?.classList.add('has-error')};
  next.addEventListener('click',event=>{if(institutionPicker&&!institutionPicker.validate()){event.stopImmediatePropagation();fail('Escolha uma instituição habilitada que aceite a condição do pacote.')} });
  next.addEventListener('click',()=>{let message='';if(step===2&&(!document.getElementById('app-diaper-model')?.value||!/^\d+$/.test(document.getElementById('app-diaper-quantity')?.value)))message='Escolha o modelo e informe a quantidade de unidades.';if(step===3&&content.querySelector('.upload-zone')?.dataset.ready!=='true')message='Adicione pelo menos uma foto do produto.';if(step===4){const condition=content.querySelector('input[name="condition"]:checked')?.value;const attested=document.querySelector('#app-open-package-attestation input')?.checked;if(!content.querySelector('.form-group input')?.value.trim()||!content.querySelector('textarea')?.value.trim())message='Informe a validade e a descrição do produto.';else if(condition==='open'&&!attested)message='Confirme as condições sanitárias do pacote aberto.'}if(step===5&&(readDraft().kind||'sale')==='sale'&&parsePrice(content.querySelector('.proposal-value')?.value)===null)message='Informe o valor do anúncio.';if(step===7){const inputs=content.querySelectorAll('.form-group input');if((inputs[0]?.value.replace(/\D/g,'').length||0)!==8||!inputs[1]?.value.trim())message='Informe um CEP válido e o bairro.'}if(message)return fail(message);error.textContent='';next.disabled=true;next.innerHTML='<span class="inline-spinner"></span> Salvando...';setTimeout(()=>{location.pathname=`/app/publish-${step+1}`},400)})
}


setupPublishValidation();

const publish = document.querySelector("#publish-submit");
const publishContent = document.querySelector("#publish-content");
publish?.addEventListener("click", async () => {
  if (publish.disabled) return;
  publish.disabled = true;
  publish.innerHTML = '<span class="inline-spinner"></span> Enviando para revisão...';
  try {
    const draft = readDraft();
    const mediaKey = sessionStorage.getItem("fc.publishMediaKey");
    const issues=validatePublicationDraft(draft,{mediaKeys:mediaKey?[mediaKey]:[]});
    if(issues.length){
      const step=publishContent.querySelector?.('.publish-step');
      if(step){let host=step.querySelector('#publication-issues');if(!host){host=document.createElement('section');host.id='publication-issues';step.append(host)}renderPublicationIssues(host,issues);}
      throw new Error(issues[0].message);
    }
    const text=publicationText(draft);
    const locationFields=publicationLocationFields(draft);
    const payload=await preparePublicationAttempt(sessionStorage,'fc.publishAttempt',{draft,mediaKey},async()=>({
      title:text.title,description:text.description,
      category:draft.category, brand:draft.brand, model:draft.model,
      packageCondition:draft.packageCondition, openPackageAttested:Boolean(draft.openPackageAttested),
      size:draft.size, quantity:Number(draft.quantity), kind:draft.kind,
      priceCents: listingPrice(draft),
      institutionId: draft.kind==='donation'?draft.institutionId:null,
      mediaKeys: [mediaKey],
      ...locationFields,
    }));
    const result=await publishListing(payload);
    sessionStorage.setItem("fc.lastListingId", result.listing.id);
    sessionStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem('fc.publishMediaKey');
    sessionStorage.removeItem('fc.publishAttempt');
    reviewPhoto?.dispose();reviewPhoto=null;
    const state=document.createElement('section');state.className='ui-state success-state';
    const heading=document.createElement('h1');heading.textContent=result.listing.status==='review'?'Anúncio enviado para revisão':'Anúncio recebido';
    const explanation=document.createElement('p');explanation.textContent=result.listing.status==='review'?'Seu anúncio ainda não está visível no catálogo. Acompanhe a análise em Meus anúncios.':'Consulte o estado do anúncio em Meus anúncios.';
    const link=document.createElement('a');link.href='/app/profile-ads';link.textContent='Acompanhar meus anúncios';state.append(heading,explanation,link);publishContent.replaceChildren(state);
    notify(heading.textContent);
  } catch (error) {
    publicationAttemptFailed(sessionStorage,'fc.publishAttempt',error);
    notify(error.status === 401 ? "Entre na sua conta para publicar." : error.message);
    publish.disabled = false;
    publish.textContent = "Enviar para revisão";
    if (error.status === 401) location.pathname = "/app/login";
  }
});


