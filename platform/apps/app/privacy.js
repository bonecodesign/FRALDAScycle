import {apiRequest} from '/packages/contracts/api-client.js';
const form=document.getElementById('privacy-form'),assessment=document.getElementById('privacy-assessment'),feedback=document.getElementById('privacy-feedback');
let key=crypto.randomUUID(),fingerprint='',reviewer=false,selected=null;
const lock=(f,state)=>f.querySelector('fieldset').disabled=state;
const labels={access:'Acesso',correction:'Correção',deletion:'Exclusão'};
function detailText(request){const o=request.currentObligations;
  const lines=['FC-S-'+request.protocol+' — '+labels[request.kind]+' — '+(request.status==='open'?'Pedido registrado':'Em análise'),request.details,
    'Operações em andamento: '+o.active_transactions,'Casos financeiros a conferir: '+o.payment_cases,'Ocorrências operacionais: '+o.operational_disputes,
    'Registros financeiros: '+o.financial_records,'Compartilhamentos de endereço: '+o.shared_address_records,'Mensagens próprias: '+o.message_records,
    'Retenção: aguardando revisão. Encerramento e exclusão não autorizados.'];
  for(const a of request.assessments)lines.push('Análise '+a.version+': '+a.reason);
  return lines.join('\n');
}
async function refresh(message='Pedidos carregados.'){
  const list=document.getElementById('privacy-list');list.replaceChildren();
  try{const data=await apiRequest('/v1/privacy-requests');
    if(!data.items.length)list.textContent='Nenhum pedido de privacidade registrado.';
    for(const item of data.items){const article=document.createElement('article'),p=document.createElement('p');p.textContent='FC-S-'+item.protocol+' — '+labels[item.kind]+' — '+(item.status==='open'?'Pedido registrado':'Em análise');article.append(p);
      const b=document.createElement('button');b.type='button';b.className='button secondary block';b.textContent='Consultar pedido';b.addEventListener('click',async()=>{lock(assessment,true);try{const data=await apiRequest('/v1/privacy-requests/'+item.id);selected=data.request;document.getElementById('privacy-detail').textContent=detailText(selected);if(reviewer){assessment.elements.requestId.value=item.id;lock(assessment,false);assessment.elements.reason.focus();}}catch(e){feedback.textContent=e.message;}});article.append(b);list.append(article);}
    feedback.textContent=message;
  }catch(e){feedback.textContent=e.message;}
}
form.addEventListener('submit',async e=>{e.preventDefault();const body={kind:form.elements.kind.value,details:form.elements.details.value.trim(),confirmed:form.elements.confirmed.checked};
  const next=JSON.stringify(body);if(fingerprint!==next){key=crypto.randomUUID();fingerprint=next;}lock(form,true);
  try{const data=await apiRequest('/v1/privacy-requests',{method:'POST',body:{...body,idempotencyKey:key}});key=crypto.randomUUID();fingerprint='';form.reset();await refresh('Solicitação registrada — protocolo FC-S-'+data.request.protocol+'. Exclusão e encerramento não executados.');}catch(e){feedback.textContent=e.message;}finally{lock(form,false);}
});
assessment.addEventListener('submit',async e=>{e.preventDefault();if(!selected)return;const body={expectedVersion:selected.version,reason:assessment.elements.reason.value.trim(),confirmed:assessment.elements.confirmed.checked};lock(assessment,true);
  try{await apiRequest('/v1/privacy-requests/'+selected.id+'/assessment',{method:'POST',body});selected=null;assessment.reset();document.getElementById('privacy-detail').textContent='';await refresh('Análise registrada. Encerramento e exclusão continuam bloqueados.');}catch(e){feedback.textContent=e.message;lock(assessment,false);}
});
document.getElementById('privacy-refresh').addEventListener('click',()=>refresh());
apiRequest('/v1/auth/session').then(session=>{reviewer=session.user.role==='admin';assessment.hidden=!reviewer;lock(form,false);return refresh();}).catch(e=>{feedback.textContent=e.message;});
