import {apiRequest} from '/packages/contracts/api-client.js';
import {parsePrice} from '/packages/contracts/commercial-rules.js';
const propose=document.getElementById('exchange-propose'),manage=document.getElementById('exchange-manage'),status=document.getElementById('exchange-status');
const requestedId=new URL(location.href).searchParams.get('requestedListingId');
if(requestedId)propose.elements.requestedListingId.value=requestedId;
async function loadOwnOffers(){try{const {items}=await apiRequest('/v1/account/listings');const select=propose.elements.offeredListingId;select.replaceChildren(new Option('Selecione um anúncio seu',''));for(const item of items.filter(item=>item.kind==='exchange'&&item.status==='published'&&item.id!==requestedId)){select.add(new Option(`${item.title} · ${item.size??'tamanho não informado'}`,item.id));}if(select.options.length===1){select.replaceChildren(new Option('Nenhum anúncio seu disponível para troca',''));select.disabled=true;}}catch(error){status.textContent=error.message;if(error.status===401)window.location.assign('/app/login');}}
void loadOwnOffers();
manage.querySelector('fieldset').insertAdjacentHTML('beforeend','<label>Motivo para recusa ou cancelamento <textarea name="reason" minlength="10" maxlength="1000"></textarea></label><div class="action-pair"><button class="button secondary" type="button" id="exchange-refuse">Recusar proposta</button><button class="button secondary" type="button" id="exchange-cancel">Confirmar cancelamento bilateral</button></div>');
const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);

// Only the server decides exchange state. Serialize local actions so a delayed
// read or duplicate activation cannot replace a newer response.
let actionPending=false;
async function runAction(action){
  if(actionPending)return;
  actionPending=true;
  const controls=[...propose.querySelectorAll('button'),...manage.querySelectorAll('button'),manage.elements.transactionId,manage.elements.expectedVersion];
  const previous=controls.map(control=>control.disabled);
  controls.forEach(control=>{control.disabled=true});
  status.setAttribute('aria-busy','true');
  try{await action();}
  catch(error){status.textContent=error?.message||'Não foi possível concluir a operação.';}
  finally{
    controls.forEach((control,i)=>{control.disabled=previous[i]});
    status.setAttribute('aria-busy','false');
    actionPending=false;
  }
}
function show(exchange,expectedId){
  if(!exchange||typeof exchange.transaction_id!=='string'||!exchange.transaction_id.trim()||
      !Number.isSafeInteger(exchange.version)||exchange.version<1||
      (expectedId!==undefined&&exchange.transaction_id!==expectedId)){
    throw new Error('Resposta da operação inválida. Consulte a troca novamente.');
  }
  const difference=exchange.difference_obligation;
  const message=`Estado: ${exchange.status} · versão ${exchange.version}`+
    (exchange.legs?.length?` · pernas: ${exchange.legs.map(x=>`${x.leg} ${x.status}`).join(', ')}`:'')+
    (exchange.fee_obligations?.length?` · taxas: ${exchange.fee_obligations.map(x=>money(x.feeCents)).join(' e ')} (não cobradas)`:'')+
    (difference?` · diferença: ${money(difference.amountCents)} (${difference.status})`:'');
  sessionStorage.setItem('fc.activeTransactionId',exchange.transaction_id);
  manage.elements.transactionId.value=exchange.transaction_id;
  manage.elements.expectedVersion.value=String(exchange.version);
  // Every new decision requires a fresh explicit confirmation.
  manage.elements.confirmed.checked=false;
  status.textContent=message;
}
propose.addEventListener('submit',e=>{
  e.preventDefault();
  return runAction(async()=>{
    const requesterDeclaredValueCents=parsePrice(propose.elements.requesterDeclaredValue.value);
    if(requesterDeclaredValueCents===null)throw new Error('Informe o valor declarado do seu pacote.');
    const data=await apiRequest('/v1/exchanges',{method:'POST',body:{requestedListingId:propose.elements.requestedListingId.value.trim(),offeredListingId:propose.elements.offeredListingId.value.trim(),requesterDeclaredValueCents,confirmed:propose.elements.confirmed.checked}});
    show(data.exchange);
    propose.elements.confirmed.checked=false;
  });
});
document.getElementById('exchange-load').addEventListener('click',()=>runAction(async()=>{
  const id=manage.elements.transactionId.value.trim();
  show((await apiRequest('/v1/exchanges/'+encodeURIComponent(id))).exchange,id);
}));
manage.addEventListener('submit',e=>{
  e.preventDefault();
  return runAction(async()=>{
    const ownerDeclaredValueCents=parsePrice(manage.elements.ownerDeclaredValue.value);
    if(ownerDeclaredValueCents===null)throw new Error('Informe o valor declarado do pacote que você oferece.');
    const id=manage.elements.transactionId.value.trim();
    show((await apiRequest('/v1/exchanges/'+encodeURIComponent(id)+'/accept',{method:'POST',body:{expectedVersion:Number(manage.elements.expectedVersion.value),ownerDeclaredValueCents,confirmed:manage.elements.confirmed.checked}})).exchange,id);
  });
});
function decision(action){
  return runAction(async()=>{
    const id=manage.elements.transactionId.value.trim();
    const data=await apiRequest('/v1/exchanges/'+encodeURIComponent(id)+'/'+action,{method:'POST',body:{expectedVersion:Number(manage.elements.expectedVersion.value),reason:manage.elements.reason.value.trim(),confirmed:manage.elements.confirmed.checked}});
    show(data.exchange,id);
    if(action==='cancel'&&!data.exchange.counterpartConfirmed)status.textContent+=' · aguardando confirmação da outra parte';
  });
}
document.getElementById('exchange-refuse').addEventListener('click',()=>decision('refuse'));
document.getElementById('exchange-cancel').addEventListener('click',()=>decision('cancel'));
