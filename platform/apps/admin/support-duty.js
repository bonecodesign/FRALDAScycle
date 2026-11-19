import {apiRequest} from '/packages/contracts/api-client.js';
const panel=document.getElementById('support-duty-panel');
const form=document.getElementById('support-duty-proposal-form');
const proposals=document.getElementById('support-duty-proposals');
const assignments=document.getElementById('support-duty-assignments');
const feedback=document.getElementById('support-duty-feedback');
const refresh=document.getElementById('support-duty-refresh');
const roles={primary:'Titular de suporte',substitute:'Substituto de suporte'};
const statusLabels={pending_review:'Aguardando revisão independente',pending_founder:'Aguardando fundador',
 approved:'Aprovada',rejected:'Rejeitada',pending:'Aguardando aceite pessoal',accepted:'Aceita',declined:'Recusada',revoked:'Revogada'};
function node(tag,contents,css){const n=document.createElement(tag);if(contents!==undefined)n.textContent=contents;if(css)n.className=css;return n;}
function say(message){if(feedback)feedback.textContent=message;}
async function confirmIdentity(password){
 const pending=await apiRequest('/v1/account/step-up/request',{method:'POST',body:{
  password,purpose:'support_duty_assignment',
 }});
 const code=window.prompt('Código de confirmação enviado ao e-mail verificado:');
 if(code===null)throw Error('Confirmação cancelada.');
 const granted=await apiRequest('/v1/account/step-up/confirm',{method:'POST',body:{
  purpose:'support_duty_assignment',challenge:pending.challenge,code:code.trim(),
 }});
 if(!granted?.grantId)throw Error('Confirmação não concluída.');
 return granted.grantId;
}
let busy=false;
async function perform(path,body,label){
 if(busy)return;
 busy=true;if(refresh)refresh.disabled=true;
 try{
  const password=window.prompt('Confirme sua senha individual para esta decisão:');
  if(password===null)return;
  const grantId=await confirmIdentity(password);
  await apiRequest(path,{method:'POST',body:{...body,grantId}});
  say(label+' registrado. Sem criação de plantão ou alerta externo.');
  await load();
 }catch(error){say(error.message||'Não foi possível registrar a decisão.');}
 finally{busy=false;if(refresh)refresh.disabled=false;}
}
function decisionButton(label,handler){
 const b=node('button',label,'button secondary');b.type='button';
 b.addEventListener('click',()=>{if(busy)return;handler();});
 return b;
}
function explainRole(item){return roles[item.role_kind]||'Função não reconhecida';}
function reasonPrompt(title){
 const reason=window.prompt(title+' Justificativa (10 a 500 caracteres):');
 return typeof reason==='string'&&reason.trim().length>=10&&reason.trim().length<=500?reason.trim():null;
}
function render(items,container,kind){
 container.replaceChildren();
 for(const item of items){
  if(!item?.id||!Object.hasOwn(roles,item.role_kind)||!Object.hasOwn(statusLabels,item.status))continue;
  const card=node('article',undefined,'phone-card'),info=node('div');
  info.append(node('strong',explainRole(item)+' · '+(item.target_name||'Pessoa indicada')),
    node('p',statusLabels[item.status]));
  card.append(info);
  if(kind==='proposals'){
   if(item.canReview)for(const [approved,label] of [[true,'Aprovar revisão'],[false,'Rejeitar revisão']]){
    card.append(decisionButton(label,()=>{
     const reason=reasonPrompt(label+'.');if(reason)void perform('/v1/admin/support-duty/proposals/'+item.id+'/review',{approved,reason},label);
    }));
   }
   if(item.canDecide)for(const [approved,label] of [[true,'Autorizar como fundador'],[false,'Rejeitar como fundador']]){
    card.append(decisionButton(label,()=>{
     const reason=reasonPrompt(label+'.');if(reason)void perform('/v1/admin/support-duty/proposals/'+item.id+'/decision',{approved,reason},label);
    }));
   }
  }else{
   if(item.canRespond)for(const [accepted,label] of [[true,'Aceitar função'],[false,'Recusar função']]){
    card.append(decisionButton(label,()=>void perform('/v1/admin/support-duty/assignments/'+item.id+'/response',{accepted},label)));
   }
   if(item.canRevoke)card.append(decisionButton('Revogar função',()=>{
    const reason=reasonPrompt('Revogação.');if(reason)void perform('/v1/admin/support-duty/assignments/'+item.id+'/revoke',{reason},'Revogação');
   }));
  }
  container.append(card);
 }
 if(!container.children.length)container.append(node('p','Nenhum registro aplicável à sua conta.','muted'));
}
async function load(){
 try{
  const result=await apiRequest('/v1/admin/support-duty');
  if(!result||!Array.isArray(result.proposals)||!Array.isArray(result.assignments)||
      result.realStaffingActive!==false||result.externalDispatchAuthorized!==false||
      result.automaticPauseAuthorized!==false)throw Error('Governança indisponível para esta conta.');
  panel.hidden=false;form.hidden=!result.canPropose;
  render(result.proposals,proposals,'proposals');
  render(result.assignments,assignments,'assignments');
  say('Acompanhamento interno. Nomeação, aceite e plantão dependem de pessoas reais.');
 }catch(error){panel.hidden=true;if(error?.status!==403)say(error.message||'Governança indisponível.');}
}
form?.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 const roleKind=form.elements.roleKind.value;
 const targetUserId=form.elements.targetUserId.value.trim();
 const reason=form.elements.reason.value.trim();
 const password=form.elements.password.value;
 const submit=form.querySelector('[type=submit]');if(submit)submit.disabled=true;
 busy=true;
 try{
  const grantId=await confirmIdentity(password);
  const result=await apiRequest('/v1/admin/support-duty/proposals',{method:'POST',body:{roleKind,targetUserId,reason,grantId}});
  if(!result?.proposal)throw Error('Proposta não confirmada.');
  form.reset();say('Proposta enviada à revisão independente.');
  await load();
 }catch(error){say(error.message||'Não foi possível propor a função.');}
 finally{form.elements.password.value='';busy=false;if(submit)submit.disabled=false;}
});
refresh?.addEventListener('click',()=>{if(!busy)void load();});
if(panel&&form&&proposals&&assignments&&feedback)void load();
