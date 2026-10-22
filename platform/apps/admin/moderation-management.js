import '/apps/admin/auth.js';
import '/apps/admin/navigation.js';
import { apiRequest } from '/packages/contracts/api-client.js';
const feedback=document.getElementById('moderation-admin-feedback'),review=document.getElementById('moderation-review-form'),suspend=document.getElementById('moderation-suspend-form');
let selected=null,key=null;
async function load(message='Decisões carregadas.') {
  review.querySelector('fieldset').disabled=true;selected=null;
  try{const actor=(await apiRequest('/v1/auth/session')).user;if(!['admin','moderator'].includes(actor.role))throw new Error('Acesso restrito à moderação.');
    const result=await apiRequest('/v1/moderation/decisions');suspend.querySelector('fieldset').disabled=false;
    const list=document.getElementById('moderation-admin-list');list.replaceChildren();
    if(!result.items.length)list.textContent='Nenhuma decisão registrada.';
    for(const decision of result.items){const row=document.createElement('article');row.className='panel';const text=document.createElement('p');text.textContent=decision.id+' — '+decision.reason+' — '+decision.status;row.append(text);
      if(decision.appeal_id&&!decision.outcome){const button=document.createElement('button');button.type='button';button.textContent='Consultar contestação';button.addEventListener('click',async()=>{try{const d=(await apiRequest('/v1/moderation/decisions/'+decision.id)).decision;selected=d.id;review.elements.decisionId.value=d.id;document.getElementById('moderation-review-detail').textContent=d.reason+' — pedido: '+d.appeal_body;review.querySelector('fieldset').disabled=false;}catch(error){feedback.textContent=error.message;}});row.append(button);}list.append(row);
    }feedback.textContent=message;
  }catch(error){feedback.textContent=error.message;suspend.querySelector('fieldset').disabled=true;}
}
review.addEventListener('submit',async event=>{event.preventDefault();if(!selected)return;review.querySelector('fieldset').disabled=true;
  try{await apiRequest('/v1/moderation/decisions/'+selected+'/review',{method:'POST',body:{outcome:review.elements.outcome.value,reason:review.elements.reason.value,reviewedText:review.elements.reviewedText.value,confirmed:review.elements.confirmed.checked}});review.reset();await load('Revisão registrada.');}
  catch(error){feedback.textContent=error.message;review.querySelector('fieldset').disabled=false;}
});
suspend.addEventListener('input',()=>{key=null;});
suspend.addEventListener('submit',async event=>{event.preventDefault();suspend.querySelector('fieldset').disabled=true;key??=crypto.randomUUID();
  try{const until=new Date(suspend.elements.until.value).toISOString();await apiRequest('/v1/moderation/suspensions',{method:'POST',body:{userId:suspend.elements.userId.value,reason:suspend.elements.reason.value,until,idempotencyKey:key}});suspend.reset();key=null;await load('Suspensão temporária registrada; suporte e operações existentes preservados.');}
  catch(error){feedback.textContent=error.message;suspend.querySelector('fieldset').disabled=false;}
});document.getElementById('moderation-admin-refresh').addEventListener('click',()=>load());load();
