import { apiRequest } from './api-client.js';
import { supportReplyKey, clearSupportReplyKey } from './support-reply-key.js';
const statusLabels={open:'Aberto',under_review:'Em análise',resolved:'Resolvido'};
const validId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validProtocol=value=>/^[1-9][0-9]{0,19}$/.test(String(value??''));
const date=value=>{const parsed=new Date(value);return value&&Number.isFinite(parsed.getTime())?parsed.toLocaleString('pt-BR'):'Data não informada';};
const relativeTime=new Intl.RelativeTimeFormat('pt-BR',{numeric:'auto'});
const age=value=>{const timestamp=new Date(value).getTime();if(!value||!Number.isFinite(timestamp))return 'Data não informada';const seconds=Math.max(0,Math.floor((Date.now()-timestamp)/1000));if(seconds<60)return relativeTime.format(-seconds,'second');const minutes=Math.floor(seconds/60);if(minutes<60)return relativeTime.format(-minutes,'minute');const hours=Math.floor(minutes/60);if(hours<24)return relativeTime.format(-hours,'hour');return relativeTime.format(-Math.floor(hours/24),'day');};
export function setupSupport({admin=false}={}){
 const feedback=document.getElementById('support-feedback'),list=document.getElementById('support-list'),detail=document.getElementById('support-detail'),refresh=document.getElementById('support-refresh');
 if(!feedback||!list||!detail||!refresh)return;
 const previous=document.getElementById('support-previous'),next=document.getElementById('support-next'),pageLabel=document.getElementById('support-page'),statusFilter=document.getElementById('support-filter-status'),categoryFilter=document.getElementById('support-filter-category'),queryFilter=document.getElementById('support-filter-query'),assignmentFilter=document.getElementById('support-filter-assignment'),sortFilter=document.getElementById('support-filter-sort'),filterForm=document.getElementById('support-filter-form');
 let page=1,hasMore=false,listBusy=false,noteSaving=false;
 const lockPages=()=>{if(previous)previous.disabled=replying||noteSaving||listBusy||page<=1;if(next)next.disabled=replying||noteSaving||listBusy||!hasMore;if(statusFilter)statusFilter.disabled=replying||noteSaving||listBusy;if(categoryFilter)categoryFilter.disabled=replying||noteSaving||listBusy;if(queryFilter)queryFilter.disabled=replying||noteSaving||listBusy;if(assignmentFilter)assignmentFilter.disabled=replying||noteSaving||listBusy;if(sortFilter)sortFilter.disabled=replying||noteSaving||listBusy;if(filterForm){const submit=filterForm.querySelector('button[type=submit]');if(submit)submit.disabled=replying||noteSaving||listBusy;}};
 let detailGeneration=0,listGeneration=0,replying=false,creating=false,cancelling=false;const noteKeys=new Map();
 const say=value=>{feedback.textContent=value;};
 const text=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node;};
 const lockList=disabled=>list.querySelectorAll('button').forEach(button=>button.disabled=disabled);
 async function query(path){const signal=AbortSignal.timeout(15000);try{const result=await apiRequest(path,{signal});if(signal.aborted)throw new Error();return result;}catch(error){if(signal.aborted)throw new Error('A consulta demorou para responder. Tente novamente.');throw error;}}
 async function openTicket(id,afterReply=false){
  if((replying&&!afterReply)||noteSaving)return;
  const generation=++detailGeneration;detail.replaceChildren();say('Consultando atendimento...');
  try{
   if(!validId(id))throw new Error('Identificador de atendimento inválido.');
   const {ticket}=await query('/v1/support/tickets/'+id);if(generation!==detailGeneration)return;
   if(!ticket||ticket.id!==id||!validProtocol(ticket.protocol)||!Object.hasOwn(statusLabels,ticket.status)||typeof ticket.subject!=='string'||typeof ticket.details!=='string'||!Array.isArray(ticket.messages)||ticket.messages.some(message=>!message||typeof message.body!=='string')||(admin&&(!Array.isArray(ticket.internal_notes)||ticket.internal_notes.some(note=>!note||typeof note.body!=='string'||!Number.isSafeInteger(Number(note.id))))))throw new Error('Não foi possível confirmar o atendimento.');
   detail.append(text('h3','Protocolo FC-S-'+ticket.protocol),text('p',statusLabels[ticket.status]),text('p',ticket.subject),text('p',ticket.details));
   for(const message of ticket.messages)detail.append(text('p',date(message.created_at)+' · '+message.body));
   say('Atendimento carregado.');
   if(!admin)return;
   detail.append(text('p',ticket.assignee_id?'Responsável: '+(ticket.assignee_name||'administrador atribuído'):'Sem responsável atribuído.'));
   const assignment=document.createElement('button');assignment.type='button';assignment.className='button secondary';assignment.textContent=ticket.assigned_to_me?'Liberar atribuição':'Assumir atendimento';assignment.disabled=Boolean(ticket.assignee_id&&!ticket.assigned_to_me);detail.append(assignment);
   assignment.addEventListener('click',async()=>{if(replying||noteSaving||generation!==detailGeneration)return;const current=generation,action=ticket.assigned_to_me?'release':'claim';assignment.disabled=true;try{const result=await apiRequest('/v1/support/tickets/'+id+'/assignment',{method:'POST',body:{action}});if(current!==detailGeneration){await load(page);return;}if(result?.assignment?.id!==id||Boolean(result.assignment.assigned_to_me)!==(action==='claim'))throw new Error('Não foi possível confirmar a atribuição.');await Promise.all([load(page),openTicket(id,true)]);}catch(error){if(current===detailGeneration){assignment.disabled=false;say(error.message||'Não foi possível alterar a atribuição.');}}});
   const notes=document.createElement('section'),notesHeading=text('h3','Notas internas · somente equipe'),notesList=document.createElement('div'),noteForm=document.createElement('form'),noteLabel=text('label','Adicionar nota interna'),noteBody=document.createElement('textarea'),noteButton=text('button','Salvar nota interna'),noteStatus=text('p','');
   notesHeading.id='support-notes-heading';notes.setAttribute('aria-labelledby',notesHeading.id);notesList.className='phone-list';noteBody.className='input';noteBody.required=true;noteBody.minLength=10;noteBody.maxLength=2000;noteLabel.htmlFor='support-note-body';noteBody.id='support-note-body';noteButton.type='submit';noteButton.className='button secondary';noteStatus.setAttribute('role','status');noteStatus.setAttribute('aria-live','polite');notes.append(notesHeading,notesList);noteForm.append(noteLabel,noteBody,noteButton);notes.append(noteForm,noteStatus);detail.append(notes);
   const renderNote=note=>{const card=document.createElement('article'),content=text('p',note.body),meta=text('small',(note.author_name||'Equipe')+' · '+date(note.created_at));card.className='phone-card';card.append(content,meta);notesList.append(card);};for(const note of ticket.internal_notes)renderNote(note);
   noteForm.addEventListener('submit',async event=>{event.preventDefault();if(replying||noteSaving||generation!==detailGeneration)return;const value=noteBody.value.trim();if(value.length<10||value.length>2000){noteStatus.textContent='Escreva uma nota interna de 10 a 2000 caracteres.';return;}const key=noteKeys.get(id)||crypto.randomUUID();noteKeys.set(id,key);noteSaving=true;noteBody.disabled=true;noteButton.disabled=true;assignment.disabled=true;lockList(true);refresh.disabled=true;lockPages();noteStatus.textContent='Salvando nota interna…';try{const result=await apiRequest('/v1/support/tickets/'+id+'/notes',{method:'POST',body:{body:value,idempotencyKey:key}}),note=result?.note;if(note?.ticket_id!==id||note.body!==value||!Number.isSafeInteger(Number(note.id))||!note.created_at)throw new Error('Não foi possível confirmar a nota interna.');noteKeys.delete(id);renderNote(note);noteBody.value='';noteStatus.textContent='Nota interna registrada; visível somente à equipe.';await load(page);}catch(error){noteStatus.textContent=(error.message||'Não foi possível salvar a nota interna.')+' A chave foi preservada para uma tentativa segura.';}finally{noteSaving=false;noteBody.disabled=false;noteButton.disabled=false;assignment.disabled=Boolean(ticket.assignee_id&&!ticket.assigned_to_me);lockList(false);refresh.disabled=replying;lockPages();}});
   const form=document.createElement('form'),label=text('label','Resposta ao usuário'),body=document.createElement('textarea'),state=document.createElement('select'),button=text('button','Registrar resposta');form.id='support-reply-form';
   body.id='support-reply-body';label.htmlFor=body.id;body.className='input';body.required=true;body.minLength=10;body.maxLength=2000;
   state.className='input';state.setAttribute('aria-label','Estado do atendimento');
   for(const [value,name] of Object.entries(statusLabels)){const option=text('option',name);option.value=value;state.append(option);}
   state.value='under_review';button.type='submit';button.className='button primary';
   form.append(label,body,state,button);detail.append(form);
   const lock=disabled=>{body.disabled=disabled;state.disabled=disabled;button.disabled=disabled;};
   form.addEventListener('submit',async event=>{
    event.preventDefault();if(replying||noteSaving||generation!==detailGeneration)return;
    const answer=body.value.trim(),status=state.value;
    if(answer.length<10||answer.length>2000||!Object.hasOwn(statusLabels,status)){say('Preencha uma resposta de 10 a 2000 caracteres e um estado válido.');return;}
    replying=true;lock(true);lockList(true);refresh.disabled=true;lockPages();
    try{const idempotencyKey=await supportReplyKey(id,answer,status);const result=await apiRequest('/v1/support/tickets/'+id+'/reply',{method:'POST',body:{body:answer,status,idempotencyKey}});if(result?.id!==id||result?.status!==status)throw new Error('Não foi possível confirmar a resposta registrada.');clearSupportReplyKey(id,idempotencyKey);say('Resposta registrada. Nenhum pagamento ou cancelamento foi executado.');await load(page,true);await openTicket(id,true);}
    catch(error){detailGeneration++;say((error.message||'Não foi possível registrar a resposta.')+' Consulte o protocolo novamente antes de reenviar e confira se a resposta já foi registrada.');}
    finally{replying=false;lockList(false);refresh.disabled=replying;lockPages();}
   });
  }catch(error){if(generation===detailGeneration){detail.replaceChildren();say(error.message||'Não foi possível consultar o atendimento.');}}
 }
 async function load(target=1,afterReply=false){
  if((replying&&!afterReply)||noteSaving)return;
  const generation=++listGeneration;listBusy=true;lockPages();refresh.disabled=true;list.replaceChildren();say('Consultando pedidos...');
  try{
   const params=new URLSearchParams({page:String(target)});if(statusFilter?.value)params.set('status',statusFilter.value);if(categoryFilter?.value)params.set('category',categoryFilter.value);if(queryFilter?.value.trim())params.set('q',queryFilter.value.trim());if(assignmentFilter?.value)params.set('assignment',assignmentFilter.value);if(admin&&sortFilter?.value&&sortFilter.value!=='newest')params.set('sort',sortFilter.value);const result=await query('/v1/support/tickets?'+params);if(generation!==listGeneration)return;const {items}=result;
   if(result.page!==target||typeof result.hasMore!=='boolean')throw new Error('Não foi possível confirmar a página de pedidos.');
   if(!Array.isArray(items)||items.length>50||items.some(ticket=>!ticket||!validId(ticket.id)||!validProtocol(ticket.protocol)||!Object.hasOwn(statusLabels,ticket.status)))throw new Error('Não foi possível confirmar a lista de pedidos.');
   page=target;hasMore=result.hasMore;if(pageLabel)pageLabel.textContent='Página '+page;
   if(!items.length)list.append(text('p','Nenhum pedido registrado.'));
   for(const ticket of items){const ageText=age(ticket.created_at);const button=text('button','FC-S-'+ticket.protocol+' · '+ticket.subject+' · '+statusLabels[ticket.status]+' · '+(ticket.assignee_name||'Sem responsável')+(admin?' · Criado '+ageText+' · Atualizado em '+date(ticket.updated_at):'') );button.className='button secondary block';button.type='button';button.addEventListener('click',()=>openTicket(ticket.id));list.append(button);}
   lockList(replying);say('Pedidos carregados. Página '+page+'.');
  }catch(error){if(generation===listGeneration){list.replaceChildren();hasMore=false;say(error.message||'Não foi possível consultar os pedidos.');}}
  finally{if(generation===listGeneration){listBusy=false;refresh.disabled=replying;lockPages();}}
 }
 refresh.addEventListener('click',()=>load(1));
 previous?.addEventListener('click',()=>{if(!listBusy&&!replying&&page>1)return load(page-1);});
 next?.addEventListener('click',()=>{if(!listBusy&&!replying&&hasMore)return load(page+1);});
 statusFilter?.addEventListener('change',()=>load(1));categoryFilter?.addEventListener('change',()=>load(1));assignmentFilter?.addEventListener('change',()=>load(1));sortFilter?.addEventListener('change',()=>load(1));filterForm?.addEventListener('submit',event=>{event.preventDefault();return load(1);});
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
    const policy=result?.supportPolicy;
    const serviceMessage=policy?.firstResponseTargetBusinessDays===2&&policy?.resolutionGuaranteed===false
      ? policy.queueState==='received_outside_service_hours'
        ? ' Recebido fora do horário de atendimento; primeira resposta em até 2 dias úteis. O prazo não garante a resolução.'
        : policy.queueState==='within_service_hours'
          ? ' Recebido dentro do horário de atendimento; primeira resposta em até 2 dias úteis. O prazo não garante a resolução.'
          : ''
      : '';
    say('Pedido registrado: FC-S-'+ticket.protocol+'.'+serviceMessage);
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
