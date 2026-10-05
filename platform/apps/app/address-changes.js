import {apiRequest} from '/packages/contracts/api-client.js';
const feedback=document.getElementById('address-change-feedback'),loadForm=document.getElementById('address-change-load'),form=document.getElementById('address-change-form'),review=document.getElementById('address-change-review');
let shares=[],key=crypto.randomUUID(),fingerprint='',reviewer=false;
const lock=(f,value)=>f.querySelector('fieldset').disabled=value;
function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}
async function refresh(message='Pedidos carregados.'){
  const list=document.getElementById('address-change-list');list.replaceChildren();
  try{
    const data=await apiRequest('/v1/address-change-requests');
    if(!data.items.length)list.textContent='Nenhuma solicitação registrada.';
    for(const item of data.items){const article=document.createElement('article'),p=document.createElement('p');p.textContent='FC-S-'+item.protocol+' — '+item.status+(item.review_reason?' — '+item.review_reason:'');article.append(p);
      if(reviewer){const b=document.createElement('button');b.type='button';b.className='button secondary block';b.textContent='Analisar pedido';b.addEventListener('click',async()=>{lock(review,true);try{const d=await apiRequest('/v1/address-change-requests/'+item.id);document.getElementById('address-change-detail').textContent=JSON.stringify(d.request,null,2);review.elements.requestId.value=item.id;lock(review,false);review.elements.reason.focus();}catch(e){feedback.textContent=e.message;}});article.append(b);}list.append(article);}
    feedback.textContent=message;
  }catch(e){feedback.textContent=e.message;}
}
loadForm.addEventListener('submit',async e=>{e.preventDefault();lock(form,true);try{
  const [s,a,session]=await Promise.all([apiRequest('/v1/shipments/'+encodeURIComponent(loadForm.elements.shipmentId.value.trim())+'/addresses'),apiRequest('/v1/addresses'),apiRequest('/v1/auth/session')]);
  shares=s.items.filter(x=>x.owner_id===session.user.id);form.elements.shareId.replaceChildren();form.elements.addressId.replaceChildren();
  for(const share of shares)option(form.elements.shareId,share.id,'Endereço compartilhado — versão '+share.revision);
  for(const address of a.items)option(form.elements.addressId,address.id,address.label+' — '+address.street+', '+address.number);
  if(!shares.length||!a.items.length)throw new Error('Selecione uma entrega com endereço próprio já compartilhado e cadastre o novo endereço em Endereços.');
  lock(form,false);feedback.textContent='Escolha o novo endereço e confirme o aviso.';
}catch(error){feedback.textContent=error.message;}});
form.addEventListener('submit',async e=>{e.preventDefault();const share=shares.find(x=>x.id===form.elements.shareId.value);if(!share)return;
  const body={shareId:share.id,addressId:form.elements.addressId.value,expectedRevision:share.revision,reason:form.elements.reason.value.trim(),confirmed:form.elements.confirmed.checked,noticeVersion:'FC-ADDRESS-1'};
  const next=JSON.stringify(body);if(next!==fingerprint){key=crypto.randomUUID();fingerprint=next;}lock(form,true);
  try{const result=await apiRequest('/v1/address-change-requests',{method:'POST',body:{...body,idempotencyKey:key}});key=crypto.randomUUID();fingerprint='';form.reset();await refresh('Pedido registrado — protocolo FC-S-'+result.request.protocol+'. A alteração aguarda análise.');}
  catch(error){feedback.textContent=error.message;lock(form,false);}
});
review.addEventListener('submit',async e=>{e.preventDefault();const body={outcome:review.elements.outcome.value,reason:review.elements.reason.value.trim(),confirmed:review.elements.confirmed.checked};lock(review,true);
  try{await apiRequest('/v1/address-change-requests/'+review.elements.requestId.value+'/review',{method:'POST',body});review.reset();document.getElementById('address-change-detail').textContent='';await refresh('Análise registrada.');}catch(error){feedback.textContent=error.message;lock(review,false);}
});
document.getElementById('address-change-refresh').addEventListener('click',()=>refresh());
apiRequest('/v1/auth/session').then(session=>{reviewer=session.user.role==='admin';review.hidden=!reviewer;return refresh();}).catch(e=>{feedback.textContent=e.message;});
