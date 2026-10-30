import {apiRequest} from '/packages/contracts/api-client.js';
import {notify} from '/packages/ui/notify.js';

const panel=document.getElementById('supported-refund-panel'),search=document.getElementById('supported-refund-search'),execution=document.getElementById('supported-refund-execution'),detail=document.getElementById('supported-refund-detail'),history=document.getElementById('supported-refund-history'),review=document.getElementById('supported-refund-review'),feedback=document.getElementById('supported-refund-feedback'),confirmation=document.getElementById('supported-refund-confirmation'),queue=document.getElementById('supported-refund-queue'),filter=document.getElementById('supported-refund-filter');let queueItems=[];
const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(cents)/100);
const node=(tag,text,className)=>{const value=document.createElement(tag);if(text!==undefined)value.textContent=text;if(className)value.className=className;return value;};
const statusLabel={provider_pending:'Aprovado · aguardando envio',submitted:'Enviado · aguardando confirmação',completed:'Concluído pelo provedor',failed:'Falha no envio'};

function render(refund){
  detail.replaceChildren();
  const card=node('article',undefined,'phone-card'),content=node('div');
  content.append(node('strong',`${money(refund.refundAmountCents)} a reembolsar`),node('p',refund.reason),node('small',`Bruto ${money(refund.grossAmountCents)} · taxa da plataforma retida ${money(refund.retainedPlatformFeeCents)} · frete retido ${money(refund.retainedDeliveryFeeCents)}`),node('small',`Decisão ${refund.id} · chamado ${refund.supportTicketId}`));
  card.append(content,node('span',statusLabel[refund.status]??refund.status,'badge'));detail.append(card);
  if(refund.completedAt)detail.append(node('p',`Confirmação financeira recebida em ${new Date(refund.completedAt).toLocaleString('pt-BR')}.`,'notice'));
  if(refund.failureCode)detail.append(node('p',`Falha registrada: ${refund.failureCode}. Retorne o caso para análise; esta execução não será repetida automaticamente.`,'notice'));
  execution.hidden=!refund.executable;
  review.hidden=refund.status!=='failed';review.elements.cancellationId.value=refund.id;
  execution.elements.cancellationId.value=refund.id;execution.elements.refundAmountCents.value=String(refund.refundAmountCents);
  confirmation.textContent=`Confirmo o envio exato de ${money(refund.refundAmountCents)}`;
}

function renderQueue(){const selected=filter.value,items=queueItems.filter(item=>selected==='all'||selected==='alert'&&item.alert||item.status===selected);queue.replaceChildren();for(const item of items){const card=node('article',undefined,'phone-card'),content=node('div');content.append(node('strong',`${money(item.refundAmountCents)} · ${statusLabel[item.status]??item.status}`),node('small',`Decisão ${item.id} · chamado ${item.supportTicketId}`));if(item.alert)content.append(node('p','Confirmação do provedor em atraso — requer acompanhamento.','notice'));const button=node('button','Abrir','button secondary');button.type='button';button.addEventListener('click',async()=>{search.elements.cancellationId.value=item.id;await load(item.id);});card.append(content,button);queue.append(card);}if(!items.length)queue.append(node('p','Nenhum reembolso neste filtro.','muted'));}
async function loadHistory(id){const result=await apiRequest(`/v1/admin/supported-cancellations/${encodeURIComponent(id)}/history`);history.replaceChildren(node('h3','Histórico financeiro'));for(const item of result.checks)history.append(node('p',`${new Date(item.checkedAt).toLocaleString('pt-BR')} · conferência ${item.status} · ${money(item.amountCents)} · ${item.matched?'compatível':'bloqueada'}`,'phone-card'));for(const item of result.reviews)history.append(node('p',`${new Date(item.createdAt).toLocaleString('pt-BR')} · ${item.actorName} · ${item.action==='provider_follow_up'?'acompanhamento com provedor':'reanálise do suporte'} · ${item.note}`,'phone-card'));if(!result.checks.length&&!result.reviews.length)history.append(node('p','Nenhuma conferência ou revisão registrada.','muted'));}
async function load(id){const result=await apiRequest(`/v1/admin/supported-cancellations/${encodeURIComponent(id)}`);render(result.refund);await loadHistory(id);return result.refund;}
async function loadQueue(){try{const result=await apiRequest('/v1/admin/supported-cancellations');panel.hidden=false;queueItems=result.items;renderQueue();}catch(error){if(error.status===403)panel.hidden=true;else feedback.textContent=error.message;}}

search?.addEventListener('submit',async event=>{event.preventDefault();feedback.textContent='';execution.hidden=true;const button=search.querySelector('[type="submit"]');button.disabled=true;try{await load(search.elements.cancellationId.value.trim());}catch(error){detail.replaceChildren(node('p',error.message,'notice'));}finally{button.disabled=false;}});

execution?.addEventListener('submit',async event=>{event.preventDefault();const button=execution.querySelector('[type="submit"]');button.disabled=true;feedback.textContent='';try{
  if(!execution.elements.confirmed.checked)throw new Error('Confirme explicitamente o valor antes de continuar.');
  const requested=await apiRequest('/v1/account/step-up/request',{method:'POST',body:{password:execution.elements.password.value,purpose:'refund_execution'}});
  const code=window.prompt('Digite o código de 6 dígitos enviado ao e-mail verificado:');if(code===null)throw new Error('Confirmação cancelada.');
  const grant=await apiRequest('/v1/account/step-up/confirm',{method:'POST',body:{challenge:requested.challenge,code:code.trim(),purpose:'refund_execution'}});
  const cancellationId=execution.elements.cancellationId.value;
  await apiRequest(`/v1/admin/supported-cancellations/${encodeURIComponent(cancellationId)}/execute`,{method:'POST',body:{confirmed:true,idempotencyKey:crypto.randomUUID(),grantId:grant.grantId}});
  execution.reset();await load(cancellationId);await loadQueue();feedback.textContent='Reembolso enviado ao provedor. A conclusão ainda depende da confirmação por webhook.';notify('Reembolso enviado; aguardando confirmação do provedor');
 }catch(error){feedback.textContent=error.message;}finally{execution.elements.password.value='';button.disabled=false;}});
document.getElementById('supported-refund-refresh')?.addEventListener('click',loadQueue);loadQueue();
filter?.addEventListener('change',renderQueue);
review?.addEventListener('submit',async event=>{event.preventDefault();const button=review.querySelector('[type="submit"]');button.disabled=true;feedback.textContent='';try{const cancellationId=review.elements.cancellationId.value;await apiRequest(`/v1/admin/supported-cancellations/${encodeURIComponent(cancellationId)}/reviews`,{method:'POST',body:{action:review.elements.action.value,note:review.elements.note.value.trim()}});review.elements.note.value='';await load(cancellationId);feedback.textContent='Encaminhamento registrado sem movimentação financeira.';notify('Encaminhamento financeiro registrado');}catch(error){feedback.textContent=error.message;}finally{button.disabled=false;}});
