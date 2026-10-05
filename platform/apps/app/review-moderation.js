import {apiRequest} from '/packages/contracts/api-client.js';
const feedback=document.getElementById('review-mod-feedback'),report=document.getElementById('review-report-form'),appeal=document.getElementById('review-visibility-appeal'),decision=document.getElementById('review-mod-decision');
let reviewer=false,ownVersion=null,selected=null;
const lock=(f,value)=>f.querySelector('fieldset').disabled=value;
const statuses={public:'Pública',under_review:'Oculta para análise',removed:'Retirada da consulta pública'};
async function refresh(message='Avaliações carregadas.'){
  lock(appeal,true);const own=document.getElementById('review-own-list');own.replaceChildren();
  try{const data=await apiRequest('/v1/account/reviews');if(!data.items.length)own.textContent='Você ainda não escreveu avaliações.';
    for(const item of data.items){const article=document.createElement('article'),p=document.createElement('p');p.textContent='Nota '+item.rating+' — '+item.comment+' — '+statuses[item.visibility]+(item.review_reason?' — '+item.review_reason:'');article.append(p);
      if(item.visibility!=='public'){const b=document.createElement('button');b.type='button';b.className='button secondary block';b.textContent='Contestar ocultação';b.addEventListener('click',()=>{ownVersion=item.visibility_version;appeal.elements.reviewId.value=item.id;lock(appeal,false);appeal.elements.details.focus();});article.append(b);}own.append(article);}
    if(reviewer){const list=document.getElementById('review-mod-list');list.replaceChildren();const items=(await apiRequest('/v1/admin/review-moderation')).items;
      for(const item of items){const article=document.createElement('article'),p=document.createElement('p');p.textContent=item.id+' — '+statuses[item.visibility]+' — denúncias: '+item.report_count;article.append(p);const b=document.createElement('button');b.type='button';b.className='button secondary block';b.textContent='Analisar avaliação';b.addEventListener('click',async()=>{lock(decision,true);try{selected=(await apiRequest('/v1/admin/review-moderation/'+item.id)).review;document.getElementById('review-mod-detail').textContent=JSON.stringify(selected,null,2);decision.elements.reviewId.value=item.id;lock(decision,false);decision.elements.reason.focus();}catch(e){feedback.textContent=e.message;}});article.append(b);list.append(article);}
    }feedback.textContent=message;
  }catch(e){feedback.textContent=e.message;}
}
report.addEventListener('submit',async e=>{e.preventDefault();const id=report.elements.reviewId.value.trim(),body={category:report.elements.category.value,details:report.elements.details.value.trim(),confirmed:report.elements.confirmed.checked};lock(report,true);
  try{const data=await apiRequest('/v1/reviews/'+encodeURIComponent(id)+'/report',{method:'POST',body});report.reset();await refresh('Denúncia registrada — protocolo FC-S-'+data.report.protocol+'. Acompanhe em Ajuda.');}catch(e){feedback.textContent=e.message;}finally{lock(report,false);}
});
appeal.addEventListener('submit',async e=>{e.preventDefault();const id=appeal.elements.reviewId.value,body={expectedVersion:ownVersion,details:appeal.elements.details.value.trim(),confirmed:appeal.elements.confirmed.checked};lock(appeal,true);
  try{const data=await apiRequest('/v1/reviews/'+encodeURIComponent(id)+'/appeal',{method:'POST',body});appeal.reset();await refresh('Contestação registrada — protocolo FC-S-'+data.report.protocol+'. Acompanhe em Ajuda.');}catch(e){feedback.textContent=e.message;lock(appeal,false);}
});
decision.addEventListener('submit',async e=>{e.preventDefault();if(!selected)return;const body={expectedVersion:selected.visibility_version,outcome:decision.elements.outcome.value,reason:decision.elements.reason.value.trim(),confirmed:decision.elements.confirmed.checked};lock(decision,true);
  try{await apiRequest('/v1/admin/review-moderation/'+selected.id+'/decision',{method:'POST',body});selected=null;decision.reset();document.getElementById('review-mod-detail').textContent='';await refresh('Decisão registrada.');}catch(e){feedback.textContent=e.message;lock(decision,false);}
});
document.getElementById('review-mod-refresh').addEventListener('click',()=>refresh());
apiRequest('/v1/auth/session').then(session=>{reviewer=['admin','moderator'].includes(session.user.role);document.getElementById('review-mod-admin').hidden=!reviewer;report.elements.reviewId.value=new URLSearchParams(location.search).get('reviewId')||'';lock(report,false);return refresh();}).catch(e=>{feedback.textContent=e.message;});
