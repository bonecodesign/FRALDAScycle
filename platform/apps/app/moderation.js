import { apiRequest } from '/packages/contracts/api-client.js';
const form=document.getElementById('moderation-appeal-form'),feedback=document.getElementById('moderation-feedback');
function lock(value){form.querySelector('fieldset').disabled=value;}
async function load(message='Decisões carregadas.') {
  lock(true); const list=document.getElementById('moderation-list');list.replaceChildren();
  try {
    const result=await apiRequest('/v1/moderation/decisions');
    if(!result.items.length)list.textContent='Nenhuma decisão registrada na conta.';
    for(const decision of result.items){
      const article=document.createElement('article');article.className='panel';
      const title=document.createElement('p');title.textContent=decision.reason+' — '+decision.status;
      const identifier=document.createElement('p');identifier.textContent='Registro: '+decision.id;article.append(title,identifier);
      if(decision.appeal_id){const note=document.createElement('p');note.textContent='Contestação registrada: '+(decision.outcome||'aguardando revisão')+'. Acompanhe em Ajuda.';article.append(note);}
      else if(decision.status==='blocked'){const button=document.createElement('button');button.type='button';button.className='button secondary block';button.textContent='Contestar esta decisão';button.addEventListener('click',()=>{form.elements.decisionId.value=decision.id;lock(false);form.elements.body.focus();});article.append(button);}
      list.append(article);
    }
    feedback.textContent=message;
  }catch(error){feedback.textContent=error.message;}
}
form.addEventListener('submit',async event=>{
  event.preventDefault();const id=form.elements.decisionId.value,body=form.elements.body.value.trim();lock(true);
  try{const result=await apiRequest('/v1/moderation/decisions/'+encodeURIComponent(id)+'/appeal',{method:'POST',body:{body}});form.reset();await load('Contestação registrada'+(result.protocol?' — protocolo FC-S-'+result.protocol:'')+'. Acompanhe em Ajuda.');}
  catch(error){feedback.textContent=error.message;lock(false);}
});
document.getElementById('moderation-refresh').addEventListener('click',()=>load());load();
