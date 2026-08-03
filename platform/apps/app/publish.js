import { publishListing, uploadListingMedia } from "/packages/contracts/marketplace-ui.js";
function notify(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function setupPublishValidation(){
  const content=document.getElementById('publish-content');
  if(!content)return;
  const step=Number(content.dataset.publishStep);const next=document.getElementById('publish-next');const error=content.querySelector('.publish-error');
  const upload=content.querySelector('.upload-zone');
  if(step===3&&upload){const chooser=upload.querySelector('button');chooser.type='button';chooser.addEventListener('click',()=>{const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;chooser.disabled=true;chooser.textContent='Enviando...';try{const key=await uploadListingMedia(file);sessionStorage.setItem('fc.publishMediaKey',key)}catch(uploadError){if(uploadError.code!=='provider_not_configured'){chooser.disabled=false;chooser.textContent='Escolher foto';notify(uploadError.message);return}}upload.dataset.ready='true';upload.classList.add('ready');upload.innerHTML='<img src="/source/assets/approved/pampers-approved.png" alt="Foto adicionada do produto"><strong>1 foto adicionada</strong><p>Embalagem e lacre visíveis.</p><button class="button secondary" type="button">Trocar foto</button>';error.textContent='';upload.querySelector('button').addEventListener('click',()=>notify('Seletor de fotos aberto'))});input.click()})}
  if(!next)return;
  const fail=message=>{error.textContent=message;content.querySelector('.publish-step')?.classList.add('has-error')};
  next.addEventListener('click',()=>{let message='';if(step===2&&!content.querySelector('input')?.value.trim())message='Informe a quantidade do produto.';if(step===3&&content.querySelector('.upload-zone')?.dataset.ready!=='true')message='Adicione pelo menos uma foto do produto.';if(step===4&&(!content.querySelector('input')?.value.trim()||!content.querySelector('textarea')?.value.trim()))message='Informe a validade e a descrição do produto.';if(step===5&&(!content.querySelector('.proposal-value')?.value.trim()||!content.querySelector('.terms input')?.checked))message='Informe o valor e confirme se aceita propostas.';if(step===7){const inputs=content.querySelectorAll('.form-group input');if((inputs[0]?.value.replace(/\D/g,'').length||0)!==8||!inputs[1]?.value.trim())message='Informe um CEP válido e o bairro.'}if(message)return fail(message);error.textContent='';next.disabled=true;next.innerHTML='<span class="inline-spinner"></span> Salvando...';setTimeout(()=>{location.pathname=`/app/publish-${step+1}`},400)})
}


setupPublishValidation();

const publish = document.querySelector("#publish-submit");
const publishContent = document.querySelector("#publish-content");
publish?.addEventListener("click", async () => {
  publish.disabled = true;
  publish.innerHTML = '<span class="inline-spinner"></span> Publicando...';
  try {
    const result = await publishListing({
      title: "Pampers Confort M · 50 unidades",
      description: "Pacote novo, lacrado e pronto para uma negociação segura.",
      brand: "Pampers", size: "M", quantity: 50, kind: "sale", priceCents: 4200,
      mediaKeys: sessionStorage.getItem("fc.publishMediaKey") ? [sessionStorage.getItem("fc.publishMediaKey")] : [],
    });
    sessionStorage.setItem("fc.lastListingId", result.listing.id);
    publishContent.innerHTML = '<div class="ui-state success-state"><div class="state-icon success">✓</div><span class="eyebrow">Anúncio publicado</span><h1>Seu anúncio está no ar!</h1><p>Pampers Confort já pode ser encontrado por famílias próximas.</p><a class="button primary block" href="/app/home">Ver anúncio na página inicial</a><a class="button secondary block" href="/app/profile">Gerenciar meus anúncios</a></div>';
    notify("Anúncio publicado com sucesso");
  } catch (error) {
    notify(error.status === 401 ? "Entre na sua conta para publicar." : error.message);
    publish.disabled = false;
    publish.textContent = "Publicar anúncio";
    if (error.status === 401) location.pathname = "/app/login";
  }
});
