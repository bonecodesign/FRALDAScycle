import { notify } from "/packages/ui/notify.js";
import "/packages/ui/iconography.js";
import { detectProhibitedContent } from '/packages/contracts/content-moderation.js';
import { apiRequest } from "/packages/contracts/api-client.js";


function blockedChatContent(value) {
  const reasons=detectProhibitedContent(value,{chat:true});
  return reasons.includes('chat_conditions')?'O preço e as condições não podem ser alterados pelo chat.':reasons.length?'Possível contato externo: o servidor registrará o bloqueio para correção ou contestação.':'';
}

async function setupProtectedChat() {
  const form = document.getElementById("chat-form");
  if (!form) return;
  const input = document.getElementById("msg");
  const error = document.getElementById("chat-error");
  const gate = document.getElementById("chat-payment-gate");
  const submit = form.querySelector('button[type="submit"]');
  const transactionId = sessionStorage.getItem("fc.activeTransactionId");
  let chatAllowed = false;
  input.disabled = true;
  submit.disabled = true;
  if (gate) gate.textContent = "Verificando a autorização do chat…";
  if (transactionId) {
    try {
      const access = await apiRequest(`/v1/transactions/${encodeURIComponent(transactionId)}/chat-access`);
      chatAllowed = access.allowed === true;
    } catch {
      chatAllowed = false;
    }
  }
  input.disabled = !chatAllowed;
  submit.disabled = !chatAllowed;
  if (gate) {
    gate.textContent = chatAllowed
      ? "Pagamento confirmado. Use o chat somente para combinar preparação, coleta ou retirada."
      : "Chat bloqueado. O servidor libera a conversa somente após confirmar o pagamento e os participantes.";
  }

  let ownerId=null;
  const messages=document.getElementById('message-list');
  async function reloadMessages() {
    const result=await apiRequest(`/v1/transactions/${encodeURIComponent(transactionId)}/messages`);
    messages.replaceChildren();
    for(const item of result.items) { const row=document.createElement('div');row.className=item.author_id===ownerId?'message me':'message';row.textContent=item.body;messages.append(row); }
    if(!result.items.length)messages.textContent='Ainda não há mensagens nesta operação.';
  }
  if(chatAllowed) {
    try { ownerId=(await apiRequest('/v1/auth/session')).user.id;await reloadMessages(); }
    catch(problem) { chatAllowed=false;input.disabled=true;submit.disabled=true;error.textContent=problem.message; }
  }
  let retryKey=null, retryBody=null;
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!chatAllowed)return;
    const message=input.value.trim();
    if(!message) { error.textContent='Digite uma mensagem para enviar.';return; }
    if(message!==retryBody){retryBody=message;retryKey=crypto.randomUUID();}
    error.textContent=blockedChatContent(message);submit.disabled=true;
    try {
      await apiRequest(`/v1/transactions/${encodeURIComponent(transactionId)}/messages`,{method:'POST',body:{body:message,idempotencyKey:retryKey}});
      input.value='';retryKey=null;retryBody=null;error.textContent='';await reloadMessages();notify('Mensagem operacional registrada');
    } catch(problem) {error.textContent=problem.message;}
    finally {submit.disabled=false;}
  });
}

function setupSafetyActions() {
  const content = document.getElementById("safety-content");
  if (!content) return;
  const form = document.getElementById("safety-form");
  const reason = document.getElementById("safety-reason");
  const details = document.getElementById("safety-details");
  const error = document.getElementById("safety-error");
  let key=null;
  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!reason.value||details.value.trim().length<10){error.textContent='Selecione o motivo e descreva o ocorrido com pelo menos 10 caracteres.';return;}
    const submit=form.querySelector('button[type=submit]');submit.disabled=true;key??=crypto.randomUUID();
    try {
      const result=await apiRequest('/v1/support/tickets',{method:'POST',body:{category:'general',subject:'Denúncia: '+reason.value,details:details.value.trim(),transactionId:sessionStorage.getItem('fc.activeTransactionId')||null,idempotencyKey:key}});
      error.textContent='Denúncia registrada. Protocolo FC-S-'+result.ticket.protocol+'. Acompanhe em Ajuda.';
      form.reset();key=null;notify('Denúncia registrada no suporte');
    }catch(problem){error.textContent=problem.message;}
    finally{submit.disabled=false;}
  });
}

void setupProtectedChat();
setupSafetyActions();


