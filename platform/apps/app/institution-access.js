import {apiRequest} from '/packages/contracts/api-client.js';
const feedback=document.getElementById('institution-access-feedback'),accept=document.getElementById('institution-access-accept'),assign=document.getElementById('institution-access-assign'),review=document.getElementById('institution-access-review');
let actor=null,reviewer=false,acceptedVersion=null,reviewVersion=null;
const lock=(f,value)=>f.querySelector('fieldset').disabled=value;
const labels={pending:'Aguardando aceite',accepted:'Aceito, aguardando conferência',verified:'Autorização registrada',revoked:'Revogado'};
async function refresh(message='Vínculos carregados.'){
 lock(accept,true);lock(review,true);const list=document.getElementById('institution-access-list');list.replaceChildren();
 try{const data=await apiRequest('/v1/institution-access');if(!data.items.length)list.textContent='Nenhum vínculo indicado para esta conta.';
  for(const item of data.items){const article=document.createElement('article'),p=document.createElement('p');p.textContent=item.public_name+' — '+labels[item.status]+' — instituição '+item.institution_status+' — versão '+item.version;article.append(p);
   if(item.user_id===actor.id&&item.status==='pending'){const b=document.createElement('button');b.type='button';b.className='button secondary block';b.textContent='Consultar vínculo para aceite';b.addEventListener('click',()=>{acceptedVersion=item.version;accept.elements.institutionId.value=item.institution_id;lock(accept,false);accept.elements.confirmed.focus();});article.append(b);}
   if(reviewer){const b=document.createElement('button');b.type='button';b.className='button secondary block';b.textContent='Analisar vínculo';b.addEventListener('click',()=>{reviewVersion=item.version;review.elements.institutionId.value=item.institution_id;assign.elements.institutionId.value=item.institution_id;assign.elements.userId.value=item.user_id;assign.elements.expectedVersion.value=item.version;lock(review,false);review.elements.reason.focus();});article.append(b);}list.append(article);
  }feedback.textContent=message;
 }catch(e){feedback.textContent=e.message;}
}
accept.addEventListener('submit',async e=>{e.preventDefault();const id=accept.elements.institutionId.value,body={expectedVersion:acceptedVersion,confirmed:accept.elements.confirmed.checked};lock(accept,true);
 try{await apiRequest('/v1/institution-access/'+encodeURIComponent(id)+'/accept',{method:'POST',body});accept.reset();await refresh('Aceite registrado; aguarde a conferência administrativa.');}catch(e){feedback.textContent=e.message;lock(accept,false);}
});
assign.addEventListener('submit',async e=>{e.preventDefault();const id=assign.elements.institutionId.value.trim(),body={userId:assign.elements.userId.value.trim(),expectedVersion:Number(assign.elements.expectedVersion.value),reason:assign.elements.reason.value.trim(),confirmed:assign.elements.confirmed.checked};lock(assign,true);
 try{await apiRequest('/v1/institution-access/'+encodeURIComponent(id)+'/assign',{method:'POST',body});assign.reset();await refresh('Convite registrado na plataforma, sem envio externo.');}catch(e){feedback.textContent=e.message;}finally{lock(assign,false);}
});
review.addEventListener('submit',async e=>{e.preventDefault();const id=review.elements.institutionId.value,body={expectedVersion:reviewVersion,outcome:review.elements.outcome.value,reason:review.elements.reason.value.trim(),confirmed:review.elements.confirmed.checked};lock(review,true);
 try{await apiRequest('/v1/institution-access/'+encodeURIComponent(id)+'/review',{method:'POST',body});review.reset();await refresh('Conferência registrada.');}catch(e){feedback.textContent=e.message;lock(review,false);}
});
document.getElementById('institution-access-refresh').addEventListener('click',()=>refresh());
apiRequest('/v1/auth/session').then(session=>{actor=session.user;reviewer=actor.role==='admin';document.getElementById('institution-access-admin').hidden=!reviewer;lock(assign,!reviewer);return refresh();}).catch(e=>{feedback.textContent=e.message;});
