import { apiRequest } from "/packages/contracts/api-client.js";
import { notify } from "/packages/ui/notify.js";

const form = document.getElementById("operational-control-form");
const states = document.getElementById("operational-control-states");
const summary = document.getElementById("operational-control-summary");
const feedback = document.getElementById("operational-control-feedback");
const resumePassword=document.getElementById('operational-resume-password'),resumeList=document.getElementById('operational-resume-list'),resumeDecision=document.getElementById('operational-resume-decision'),resumeSelected=document.getElementById('operational-resume-selected');
const labels = { global: "Toda a plataforma", marketplace: "Marketplace", payments: "Novas cobranças", refunds: "Reembolsos", payouts: "Preparação de repasses", logistics: "Logística", donations: "Doações", premium: "Premium" };

function render(items) {
  if (!states) return;
  if (!Array.isArray(items) || items.some(item => !item || !Object.hasOwn(labels,item.domain) || typeof item.paused !== 'boolean' || (item.paused && typeof item.reason !== 'string'))) throw new Error('Estado operacional inválido.');
  states.replaceChildren();
  for (const item of items) {
    const article=document.createElement('article'),icon=document.createElement('span'),content=document.createElement('div'),title=document.createElement('strong'),reason=document.createElement('p'),badge=document.createElement('span');
    article.className='phone-card';icon.className='status-icon';icon.textContent=item.paused?'!':'✓';
    title.textContent=labels[item.domain];reason.textContent=item.paused?item.reason:'Novas operações autorizadas';
    badge.className='badge'+(item.paused?' warn':'');badge.textContent=item.paused?'Pausado':'Ativo';
    content.append(title,reason);article.append(icon,content,badge);states.append(article);
  }
  const paused = items.filter(item => item.paused).length;
  summary.textContent = paused ? `${paused} domínio${paused === 1 ? "" : "s"} pausado${paused === 1 ? "" : "s"}` : "Operação ativa";
}

async function load() {
  if (!form) return;
  states?.replaceChildren();
  try {
    const result = await apiRequest("/v1/admin/operational-control");
    render(result.items);
    document.documentElement.dataset.operationalControlState = "live";
  } catch (error) {
    summary.textContent = "Indisponível no modo demonstrativo";
    document.documentElement.dataset.operationalControlState = error.status === 401 ? "unauthenticated" : error.status === 403 ? "forbidden" : "fallback";
  }
}

async function stepUp(password){const requested=await apiRequest('/v1/account/step-up/request',{method:'POST',body:{password,purpose:'operational_resume'}});const code=window.prompt('Digite o código de 6 dígitos enviado ao e-mail verificado:');if(code===null)throw new Error('Confirmação cancelada.');return apiRequest('/v1/account/step-up/confirm',{method:'POST',body:{challenge:requested.challenge,code:code.trim(),purpose:'operational_resume'}});}
function chooseResume(item){resumeDecision.hidden=false;resumeDecision.elements.requestId.value=item.id;resumeSelected.textContent=`${labels[item.domain]} · solicitado por ${item.proposer_name}`;resumeDecision.elements.reason.focus();}
async function loadResumeRequests(){try{const result=await apiRequest('/v1/admin/operational-resume-requests');resumeList.replaceChildren();for(const item of result.items){const article=document.createElement('article'),content=document.createElement('div'),title=document.createElement('strong'),text=document.createElement('p'),badge=document.createElement('span');article.className='phone-card';title.textContent=labels[item.domain]??item.domain;text.textContent=item.reason;badge.className='badge';badge.textContent=item.status;content.append(title,text);article.append(content,badge);if(item.status==='pending'&&result.canDecide){const button=document.createElement('button');button.type='button';button.className='button secondary';button.textContent='Decidir';button.addEventListener('click',()=>chooseResume(item));article.append(button);}resumeList.append(article);}if(!result.items.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Nenhuma solicitação registrada.';resumeList.append(empty);}}catch(error){if(error.status!==403)feedback.textContent=error.message;}}
form?.elements.action?.addEventListener('change',()=>{const resume=form.elements.action.value==='resume';resumePassword.hidden=!resume;form.elements.password.required=resume;});

form?.addEventListener("submit", async event => {
  event.preventDefault();
  feedback.textContent = "";
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    if(form.elements.action.value==='resume'){const grant=await stepUp(form.elements.password.value);await apiRequest('/v1/admin/operational-resume-requests',{method:'POST',body:{domain:form.elements.domain.value,reason:form.elements.reason.value.trim(),grantId:grant.grantId}});}else await apiRequest("/v1/admin/operational-control", { method: "PUT", body: {domain:form.elements.domain.value,action:'pause',reason:form.elements.reason.value.trim(),confirmed:form.elements.confirmed.checked} });
    form.reset();
    resumePassword.hidden=true;await load();await loadResumeRequests();
    feedback.textContent = "Alteração ou solicitação registrada com auditoria.";
    notify("Controle operacional atualizado");
  } catch (error) {
    feedback.textContent = error.message;
  } finally { submit.disabled = false; }
});

resumeDecision?.addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter,approved=button?.value==='true';button.disabled=true;feedback.textContent='';try{const grant=await stepUp(resumeDecision.elements.password.value);await apiRequest(`/v1/admin/operational-resume-requests/${encodeURIComponent(resumeDecision.elements.requestId.value)}/decision`,{method:'POST',body:{approved,reason:resumeDecision.elements.reason.value.trim(),grantId:grant.grantId}});resumeDecision.reset();resumeDecision.hidden=true;await load();await loadResumeRequests();notify(approved?'Retomada autorizada pelo fundador':'Retomada rejeitada');}catch(error){feedback.textContent=error.message;}finally{resumeDecision.elements.password.value='';button.disabled=false;}});

load();if(resumeList)loadResumeRequests();
