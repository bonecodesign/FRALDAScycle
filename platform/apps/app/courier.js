import { apiRequest } from "/packages/contracts/api-client.js";
import { uploadListingMedia } from "/packages/contracts/marketplace-ui.js";
function notify(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

const photoButton = document.querySelector(".panel .button.secondary");
photoButton?.addEventListener("click", () => {
  photoButton.disabled = true;
  photoButton.textContent = "Foto adicionada";
  photoButton.closest(".panel")?.classList.add("ready");
  notify("Foto e localização registradas com segurança");
});

document.querySelector('[data-action="delivery"]')?.addEventListener("click", () => {
  notify("Recebimento confirmado");
});

async function currentLocation(){
  return new Promise((resolve,reject)=>navigator.geolocation?.getCurrentPosition(
    position=>resolve({latitude:position.coords.latitude,longitude:position.coords.longitude}),
    ()=>reject(new Error('Permita o acesso à localização para concluir a entrega.')),
    {enableHighAccuracy:true,timeout:10000,maximumAge:0},
  )??reject(new Error('Localização indisponível.')))
}
function setupRealDeliveryProof(){
  const photo=document.querySelector(".panel .button.secondary");
  photo?.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.addEventListener('change',()=>{const file=input.files?.[0];if(!file)return;photo.disabled=true;photo.textContent='Enviando foto...';void uploadListingMedia(file).then(storageKey=>{sessionStorage.setItem('fc.deliveryProofMediaKey',storageKey);photo.textContent='Foto adicionada';photo.closest('.panel')?.classList.add('ready');notify('Foto registrada com segurança')}).catch(error=>{photo.disabled=false;photo.textContent='Adicionar foto';notify(error.message)})},{once:true});input.click()},true);
  const action=document.querySelector('[data-action="delivery"]');if(!action)return;
  action.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();const shipmentId=sessionStorage.getItem('fc.activeShipmentId');const mediaKey=sessionStorage.getItem('fc.deliveryProofMediaKey');const recipientName=document.querySelector('.phone-content .form-group input')?.value.trim();if(!shipmentId||!mediaKey){notify('Adicione a foto da entrega antes de concluir');return}action.setAttribute('aria-disabled','true');void currentLocation().then(location=>apiRequest('/v1/shipments/'+shipmentId+'/proof',{method:'POST',body:{mediaKey,recipientName,...location}})).then(()=>{notify('Recebimento confirmado');window.location.assign('/courier/history')}).catch(error=>{action.removeAttribute('aria-disabled');notify(error.message||'Não foi possível concluir a entrega')})},true)
}

setupRealDeliveryProof();
