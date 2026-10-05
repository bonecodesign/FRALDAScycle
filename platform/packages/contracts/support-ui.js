import { apiRequest } from './api-client.js';
const statusLabels = { open:'Aberto', under_review:'Em análise', resolved:'Resolvido' };
export function setupSupport({admin=false}={}) {
  const feedback=document.getElementById('support-feedback');
  const list=document.getElementById('support-list');
  const detail=document.getElementById('support-detail');
  const refresh=document.getElementById('support-refresh');
  if(!feedback||!list||!detail||!refresh)return;
  let detailGeneration=0;
  const say=value=>{feedback.textContent=value;};
  const text=(tag,value)=>{const element=document.createElement(tag);element.textContent=value;return element;};
  async function openTicket(id) {
    const generation=++detailGeneration;
    detail.replaceChildren();
    const {ticket}=await apiRequest('/v1/support/tickets/'+id);
    if(generation!==detailGeneration)return;
    detail.append(text('h3','Protocolo FC-S-'+ticket.protocol),text('p',statusLabels[ticket.status]||ticket.status),text('p',ticket.subject),text('p',ticket.details));
    for(const message of ticket.messages||[]) detail.append(text('p',new Date(message.created_at).toLocaleString('pt-BR')+' · '+message.body));
    if(admin) {
      const form=document.createElement('form');
      const label=text('label','Resposta ao usuário');
      const body=document.createElement('textarea');body.id='support-reply-body';label.htmlFor=body.id;body.className='input';body.required=true;body.minLength=10;body.maxLength=2000;
      const state=document.createElement('select');state.className='input';state.setAttribute('aria-label','Estado do atendimento');
      for(const [value,name] of Object.entries(statusLabels)){const option=text('option',name);option.value=value;state.append(option);}
      state.value='under_review';
      const button=text('button','Registrar resposta');button.type='submit';button.className='button primary';
      form.append(label,body,state,button);detail.append(form);
      form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;try {
        await apiRequest('/v1/support/tickets/'+id+'/reply',{method:'POST',body:{body:body.value,status:state.value}});
        say('Resposta registrada. Nenhum pagamento ou cancelamento foi executado.');await openTicket(id);
      }catch(error){say(error.message);button.disabled=false;}});
    }
  }
  async function load() {
    refresh.disabled=true;
    try {
      const {items}=await apiRequest('/v1/support/tickets');
      list.replaceChildren();
      if(!items.length) list.append(text('p','Nenhum pedido registrado.'));
      for(const ticket of items){const button=text('button','FC-S-'+ticket.protocol+' · '+ticket.subject+' · '+(statusLabels[ticket.status]||ticket.status));button.className='button secondary block';button.type='button';button.addEventListener('click',()=>{void openTicket(ticket.id).catch(error=>say(error.message));});list.append(button);}
    }catch(error){say(error.message||'Não foi possível consultar os pedidos.');}
    finally{refresh.disabled=false;}
  }
  refresh.addEventListener('click',()=>{void load();});
  const form=document.getElementById('support-form');
  if(form) {
    form.elements.transaction.value=sessionStorage.getItem('fc.activeTransactionId')||'';
    let key=sessionStorage.getItem('fc.supportDraftKey')||crypto.randomUUID();sessionStorage.setItem('fc.supportDraftKey',key);
    form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;
      try {
        const result=await apiRequest('/v1/support/tickets',{method:'POST',body:{category:form.elements.category.value,transactionId:form.elements.transaction.value.trim()||null,subject:form.elements.subject.value,details:form.elements.details.value,idempotencyKey:key}});
        say('Pedido registrado: FC-S-'+result.ticket.protocol+'.');
        key=crypto.randomUUID();sessionStorage.setItem('fc.supportDraftKey',key);form.elements.subject.value='';form.elements.details.value='';
        await load();await openTicket(result.ticket.id);
      }catch(error){say(error.message||'Não foi possível registrar o pedido.');}
      finally{button.disabled=false;}
    });
  }
  document.getElementById('operation-cancel')?.addEventListener('click',async event=>{
    const transactionId=form?.elements.transaction.value.trim();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transactionId||'')){say('Informe o identificador da operação.');return;}
    const button=event.currentTarget;button.disabled=true;
    try{await apiRequest('/v1/transactions/'+transactionId+'/cancel',{method:'POST'});say('Operação cancelada. Não havia cobrança registrada.');}
    catch(error){say(error.message);if(error.code==='cancellation_requires_support'){form.elements.category.value='cancellation';form.elements.subject.value='Pedido de cancelamento';form.elements.details.focus();}}
    finally{button.disabled=false;}
  });
}
