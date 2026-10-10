import { apiRequest } from './api-client.js';
import { supportReplyKey, clearSupportReplyKey } from './support-reply-key.js';
const statusLabels={open:'Aberto',under_review:'Em análise',resolved:'Resolvido'};
const validId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validProtocol=value=>/^[1-9][0-9]{0,19}$/.test(String(value??''));
const date=value=>{const parsed=new Date(value);return value&&Number.isFinite(parsed.getTime())?parsed.toLocaleString('pt-BR'):'Data não informada';};
export function setupSupport({admin=false}={}){
 const feedback=document.getElementById('support-feedback'),list=document.getElementById('support-list'),detail=document.getElementById('support-detail'),refresh=document.getElementById('support-refresh');
 if(!feedback||!list||!detail||!refresh)return;
 const previous=document.getElementById('support-previous'),next=document.getElementById('support-next'),pageLabel=document.getElementById('support-page'),statusFilter=document.getElementById('support-filter-status'),categoryFilter=document.getElementById('support-filter-category'),queryFilter=document.getElementById('support-filter-query'),filterForm=document.getElementById('support-filter-form');
 let page=1,hasMore=false,listBusy=false;
 const lockPages=()=>{if(previous)previous.disabled=replying||listBusy||page<=1;if(next)next.disabled=replying||listBusy||!hasMore;if(statusFilter)statusFilter.disabled=replying||listBusy;if(categoryFilter)categoryFilter.disabled=replying||listBusy;if(queryFilter)queryFilter.disabled=replying||listBusy;if(filterForm){const submit=filterForm.querySelector('button[type=submit]');if(submit)submit.disabled=replying||listBusy;}};
 let detailGeneration=0,listGeneration=0,replying=false,creating=false,cancelling=false;
 const say=value=>{feedback.textContent=value;};
 const text=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node;};
 const lockList=disabled=>list.querySelectorAll('button').forEach(button=>button.disabled=disabled);
 async function query(path){const signal=AbortSignal.timeout(15000);try{const result=await apiRequest(path,{signal});if(signal.aborted)throw new Error();return result;}catch(error){if(signal.aborted)throw new Error('A consulta demorou para responder. Tente novamente.');throw error;}}
 async function openTicket(id,afterReply=false){
  if(replying&&!afterReply)return;
  const generation=++detailGeneration;detail.replaceChildren();say('Consultando atendimento...');
  try{
   if(!validId(id))throw new Error('Identificador de atendimento inválido.');
   const {ticket}=await query('/v1/support/tickets/'+id);if(generation!==detailGeneration)return;
   if(!ticket||ticket.id!==id||!validProtocol(ticket.protocol)||!Object.hasOwn(statusLabels,ticket.status)||typeof ticket.subject!=='string'||typeof ticket.details!=='string'||!Array.isArray(ticket.messages)||ticket.messages.some(message=>!message||typeof message.body!=='string'))throw new Error('Não foi possível confirmar o atendimento.');
   detail.append(text('h3','Protocolo FC-S-'+ticket.protocol),text('p',statusLabels[ticket.status]),text('p',ticket.subject),text('p',ticket.details));
   for(const message of ticket.messages)detail.append(text('p',date(message.created_at)+' · '+message.body));
   say('Atendimento carregado.');
   if(!admin)return;
   const form=document.createElement('form'),label=text('label','Resposta ao usuário'),body=document.createElement('textarea'),state=document.createElement('select'),button=text('button','Registrar resposta');
   body.id='support-reply-body';label.htmlFor=body.id;body.className='input';body.required=true;body.minLength=10;body.maxLength=2000;
   state.className='input';state.setAttribute('aria-label','Estado do atendimento');
   for(const [value,name] of Object.entries(statusLabels)){const option=text('option',name);option.value=value;state.append(option);}
   state.value='under_review';button.type='submit';button.className='button primary';
   form.append(label,body,state,button);detail.append(form);
   const lock=disabled=>{body.disabled=disabled;state.disabled=disabled;button.disabled=disabled;};
   form.addEventListener('submit',async event=>{
    event.preventDefault();if(replying||generation!==detailGeneration)return;
    const answer=body.value.trim(),status=state.value;
    if(answer.length<10||answer.length>2000||!Object.hasOwn(statusLabels,status)){say('Preencha uma resposta de 10 a 2000 caracteres e um estado válido.');return;}
    replying=true;lock(true);lockList(true);refresh.disabled=true;lockPages();
    try{const idempotencyKey=await supportReplyKey(id,answer,status);const result=await apiRequest('/v1/support/tickets/'+id+'/reply',{method:'POST',body:{body:answer,status,idempotencyKey}});if(result?.id!==id||result?.status!==status)throw new Error('Não foi possível confirmar a resposta registrada.');clearSupportReplyKey(id,idempotencyKey);say('Resposta registrada. Nenhum pagamento ou cancelamento foi executado.');await openTicket(id,true);}
    catch(error){detailGeneration++;say((error.message||'Não foi possível registrar a resposta.')+' Consulte o protocolo novamente antes de reenviar e confira se a resposta já foi registrada.');}
    finally{replying=false;lockList(false);refresh.disabled=replying;lockPages();}
   });
  }catch(error){if(generation===detailGeneration){detail.replaceChildren();say(error.message||'Não foi possível consultar o atendimento.');}}
 }
 async function load(target=1){
  if(replying)return;
  const generation=++listGeneration;listBusy=true;lockPages();refresh.disabled=true;list.replaceChildren();say('Consultando pedidos...');
  try{
   const params=new URLSearchParams({page:String(target)});if(statusFilter?.value)params.set('status',statusFilter.value);if(categoryFilter?.value)params.set('category',categoryFilter.value);if(queryFilter?.value.trim())params.set('q',queryFilter.value.trim());const result=await query('/v1/support/tickets?'+params);if(generation!==listGeneration)return;const {items}=result;
   if(result.page!==target||typeof result.hasMore!=='boolean')throw new Error('Não foi possível confirmar a página de pedidos.');
   if(!Array.isArray(items)||items.length>50||items.some(ticket=>!ticket||!validId(ticket.id)||!validProtocol(ticket.protocol)||!Object.hasOwn(statusLabels,ticket.status)))throw new Error('Não foi possível confirmar a lista de pedidos.');
   page=target;hasMore=result.hasMore;if(pageLabel)pageLabel.textContent='Página '+page;
   if(!items.length)list.append(text('p','Nenhum pedido registrado.'));
   for(const ticket of items){const button=text('button','FC-S-'+ticket.protocol+' · '+ticket.subject+' · '+statusLabels[ticket.status]);button.className='button secondary block';button.type='button';button.addEventListener('click',()=>openTicket(ticket.id));list.append(button);}
   lockList(replying);say('Pedidos carregados. Página '+page+'.');
  }catch(error){if(generation===listGeneration){list.replaceChildren();hasMore=false;say(error.message||'Não foi possível consultar os pedidos.');}}
  finally{if(generation===listGeneration){listBusy=false;refresh.disabled=replying;lockPages();}}
 }
 refresh.addEventListener('click',()=>load(1));
 previous?.addEventListener('click',()=>{if(!listBusy&&!replying&&page>1)return load(page-1);});
 next?.addEventListener('click',()=>{if(!listBusy&&!replying&&hasMore)return load(page+1);});
 statusFilter?.addEventListener('change',()=>load(1));categoryFilter?.addEventListener('change',()=>load(1));filterForm?.addEventListener('submit',event=>{event.preventDefault();return load(1);});
 const form=document.getElementById('support-form'),cancel=document.getElementById('operation-cancel');
 const lockCreation=disabled=>{form?.querySelectorAll('input,select,textarea,button').forEach(control=>control.disabled=disabled);if(cancel)cancel.disabled=disabled;};
 if(form){
  form.elements.transaction.value=sessionStorage.getItem('fc.activeTransactionId')||'';
  let key=sessionStorage.getItem('fc.supportDraftKey')||crypto.randomUUID();sessionStorage.setItem('fc.supportDraftKey',key);
  const rotateKey=()=>{key=crypto.randomUUID();sessionStorage.setItem('fc.supportDraftKey',key);};
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(creating||cancelling)return;
   const input={category:form.elements.category.value,transactionId:form.elements.transaction.value.trim().toLowerCase()||null,subject:form.elements.subject.value.trim(),details:form.elements.details.value.trim(),idempotencyKey:key};
   if(input.subject.length<5||input.subject.length>120||input.details.length<10||input.details.length>2000||!['general','cancellation','receipt_problem','privacy','account'].includes(input.category)||(input.transactionId&&!validId(input.transactionId))||(['cancellation','receipt_problem'].includes(input.category)&&!input.transactionId)){say('Informe categoria, assunto, descrição e a operação quando necessária.');return;}
   creating=true;lockCreation(true);
   try{
    const result=await apiRequest('/v1/support/tickets',{method:'POST',body:input});
    const ticket=result?.ticket;if(!ticket||!validId(ticket.id)||!validProtocol(ticket.protocol)||!Object.hasOwn(statusLabels,ticket.status))throw new Error('Não foi possível confirmar o pedido. Confira o acompanhamento antes de tentar novamente.');
    if(ticket.subject!==input.subject||ticket.details!==input.details||ticket.category!==input.category||(ticket.transaction_id??null)!==input.transactionId){rotateKey();throw new Error('A chave corresponde a um pedido anterior. O rascunho foi preservado para um novo envio; confira o acompanhamento.');}
    rotateKey();form.elements.subject.value='';form.elements.details.value='';await load();await openTicket(ticket.id);
    say('Pedido registrado: FC-S-'+ticket.protocol+'.');
   }catch(error){say(error.message||'Não foi possível registrar o pedido.');}
   finally{creating=false;lockCreation(false);}
  });
 }
 cancel?.addEventListener('click',async()=>{
  if(cancelling||creating)return;
  const transactionId=form?.elements.transaction.value.trim().toLowerCase();if(!validId(transactionId)){say('Informe o identificador da operação.');return;}
  cancelling=true;lockCreation(true);
  try{const result=await apiRequest('/v1/transactions/'+transactionId+'/cancel',{method:'POST'});if(result.transaction?.id!==transactionId||result.transaction?.status!=='cancelled')throw new Error('Não foi possível confirmar o cancelamento. Consulte a operação.');say('Operação cancelada. Não havia cobrança registrada.');}
  catch(error){say(error.message);if(error.code==='cancellation_requires_support'){form.elements.category.value='cancellation';form.elements.subject.value='Pedido de cancelamento';}}
  finally{cancelling=false;lockCreation(false);if(form.elements.category.value==='cancellation')form.elements.details.focus();}
 });
}
