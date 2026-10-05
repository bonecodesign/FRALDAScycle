import { apiRequest } from '/packages/contracts/api-client.js';
const form=document.getElementById('review-form'),feedback=document.getElementById('reviews-feedback');
async function load(){
  try{const user=(await apiRequest('/v1/auth/session')).user;const result=await apiRequest('/v1/users/'+user.id+'/reviews');
    const list=document.getElementById('reviews-list');list.replaceChildren();
    if(!result.items.length)list.textContent='Nenhuma avaliação recebida.';
    for(const review of result.items){const article=document.createElement('article');article.className='panel';article.textContent='Nota '+review.rating+'/5 — '+review.comment;list.append(article);}
    form.querySelector('fieldset').disabled=false;form.elements.transactionId.value=sessionStorage.getItem('fc.activeTransactionId')||'';
  }catch(error){feedback.textContent=error.message;}
}
form.addEventListener('submit',async event=>{event.preventDefault();const fieldset=form.querySelector('fieldset');fieldset.disabled=true;
  try{await apiRequest('/v1/transactions/'+encodeURIComponent(form.elements.transactionId.value)+'/reviews',{method:'POST',body:{rating:Number(form.elements.rating.value),comment:form.elements.comment.value}});feedback.textContent='Avaliação registrada.';}
  catch(error){feedback.textContent=error.message;}finally{fieldset.disabled=false;}
});load();
