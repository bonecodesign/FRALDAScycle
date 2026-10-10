import '/apps/admin/auth.js';
import { apiRequest } from '/packages/contracts/api-client.js';
const dateTime=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'});
const categoryLabels=Object.freeze({general:'Geral',cancellation:'Cancelamento',receipt_problem:'Problema no recebimento',privacy:'Privacidade',account:'Conta'});
const statusLabels=Object.freeze({open:'Aberto',under_review:'Em análise',resolved:'Resolvido'});
const form=document.getElementById('support-reply-form');
const panel=document.getElementById('support-detail');
const replyStatus=document.getElementById('support-reply-status');
const rows=document.getElementById('support-rows');
let selectionGeneration=0,listGeneration=0,selected=null,replying=false;
const validId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const date=value=>{const parsed=new Date(value);return value&&Number.isFinite(parsed.getTime())?dateTime.format(parsed):'Data não informada';};
function cell(row,value){const node=document.createElement('td');node.textContent=value;row.append(node);}
function failure(error){if(error?.status===401)return 'Sessão administrativa necessária para consultar o suporte.';if(error?.status===403)return 'Esta conta não possui permissão para atender solicitações.';return error?.message||'Atendimentos indisponíveis nesta consulta.';}
function lockForm(disabled){for(const control of form.querySelectorAll('input,textarea,select,button'))control.disabled=disabled;}
function clearSelection(){selected=null;panel.hidden=true;form.elements.ticketId.value='';document.getElementById('support-detail-title').textContent='Atendimento';document.getElementById('support-detail-description').textContent='';document.getElementById('support-messages').replaceChildren();lockForm(true);}
async function query(path){const signal=AbortSignal.timeout(15000);try{const result=await apiRequest(path,{signal});if(signal.aborted)throw new Error();return result;}catch(error){if(signal.aborted)throw new Error('A consulta demorou para responder. Tente novamente.');throw error;}}
async function openTicket(id,afterReply=false){
 if(replying&&!afterReply)return;
 const generation=++selectionGeneration;clearSelection();replyStatus.textContent='Consultando atendimento…';
 if(!validId(id)){replyStatus.textContent='Identificador de atendimento inválido.';return;}
 try{
  const {ticket}=await query('/v1/support/tickets/'+id);
  if(generation!==selectionGeneration)return;
  if(!ticket||ticket.id!==id||!Object.hasOwn(statusLabels,ticket.status)||typeof ticket.subject!=='string'||typeof ticket.details!=='string'||!Array.isArray(ticket.messages))throw new Error('Não foi possível confirmar o atendimento.');
  const messages=document.getElementById('support-messages');
  for(const item of ticket.messages){if(!item||typeof item.body!=='string')throw new Error('Não foi possível confirmar as mensagens do atendimento.');const article=document.createElement('article');article.className='phone-card';const content=document.createElement('div'),body=document.createElement('p'),when=document.createElement('small');body.textContent=item.body;when.textContent=date(item.created_at);content.append(body,when);article.append(content);messages.append(article);}
  document.getElementById('support-detail-title').textContent='Protocolo '+ticket.protocol;
  document.getElementById('support-detail-description').textContent=(Object.hasOwn(categoryLabels,ticket.category)?categoryLabels[ticket.category]:'Categoria não informada')+' · '+ticket.subject+' · '+statusLabels[ticket.status]+'. '+ticket.details;
  form.elements.ticketId.value=id;form.elements.status.value=ticket.status;form.elements.body.value='';selected=id;panel.hidden=false;lockForm(replying);replyStatus.textContent=messages.children.length+' mensagem(ns) registrada(s).';panel.scrollIntoView({behavior:'smooth',block:'nearest'});
 }catch(error){if(generation!==selectionGeneration)return;clearSelection();panel.hidden=false;replyStatus.textContent=failure(error);}
}
async function loadTickets(){
 const generation=++listGeneration,status=document.getElementById('support-status');rows.replaceChildren();status.textContent='Consultando atendimentos…';
 try{
  const result=await query('/v1/support/tickets');if(generation!==listGeneration)return;
  if(!Array.isArray(result.items)||result.items.some(ticket=>!ticket||!validId(ticket.id)||!Object.hasOwn(statusLabels,ticket.status)))throw new Error('Não foi possível confirmar a fila de atendimentos.');
  for(const ticket of result.items){const row=document.createElement('tr');cell(row,ticket.protocol);cell(row,Object.hasOwn(categoryLabels,ticket.category)?categoryLabels[ticket.category]:'Categoria não informada');cell(row,ticket.subject);cell(row,statusLabels[ticket.status]);cell(row,date(ticket.created_at));const action=document.createElement('td'),button=document.createElement('button');button.type='button';button.className='button text';button.textContent='Abrir';button.disabled=replying;button.addEventListener('click',()=>openTicket(ticket.id));action.append(button);row.append(action);rows.append(row);}
  document.getElementById('support-empty').hidden=rows.rows.length>0;status.textContent=rows.rows.length.toLocaleString('pt-BR')+' atendimento(s) exibido(s).';
 }catch(error){if(generation!==listGeneration)return;rows.replaceChildren();document.getElementById('support-empty').hidden=false;status.textContent=failure(error);}
}
document.getElementById('support-refresh')?.addEventListener('click',loadTickets);
form.addEventListener('submit',async event=>{
 event.preventDefault();if(replying||!selected)return;
 const id=selected,body=form.elements.body.value.trim(),status=form.elements.status.value;
 if(body.length<10||body.length>2000||!Object.hasOwn(statusLabels,status)){replyStatus.textContent='Preencha uma resposta de 10 a 2000 caracteres e selecione um estado válido.';return;}
 replying=true;lockForm(true);rows.querySelectorAll('button').forEach(button=>button.disabled=true);replyStatus.textContent='Registrando resposta…';
 try{await apiRequest('/v1/support/tickets/'+id+'/reply',{method:'POST',body:{body,status}});replyStatus.textContent='Resposta persistida e estado atualizado.';await Promise.all([loadTickets(),openTicket(id,true)]);}
 catch(error){selected=null;form.elements.ticketId.value='';replyStatus.textContent=failure(error)+' Consulte o protocolo novamente antes de reenviar; confira se a resposta já foi registrada.';}
 finally{replying=false;lockForm(!selected);rows.querySelectorAll('button').forEach(button=>button.disabled=false);}
});
clearSelection();
await loadTickets();
