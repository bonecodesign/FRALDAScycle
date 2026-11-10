import { apiRequest } from '/packages/contracts/api-client.js';
import { notify } from '/packages/ui/notify.js';

const form=document.getElementById('incident-create-form'),list=document.getElementById('incident-list'),detail=document.getElementById('incident-detail'),feedback=document.getElementById('incident-feedback'),refresh=document.getElementById('incident-refresh');
const severityLabels={low:'Baixa',medium:'Média',high:'Alta',critical:'Crítica'};
const statusLabels={open:'Aberto',contained:'Contido',monitoring:'Monitoramento',resolved:'Resolvido'};
let selected=null;
const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};

function renderList(items){
  list.replaceChildren();
  if(!items.length){list.append(element('p','Nenhum incidente registrado.','muted'));return;}
  for(const item of items){
    const button=element('button',undefined,'phone-card');button.type='button';
    button.append(element('strong',`${item.reference} · ${item.title}`),element('span',`${severityLabels[item.severity]} · ${statusLabels[item.status]}`,'badge'));
    button.addEventListener('click',()=>loadDetail(item.id));list.append(button);
  }
}

function renderDetail(result){
  selected=result.incident;detail.replaceChildren();
  detail.append(element('h4',`${selected.reference} · ${selected.title}`),element('p',selected.summary),element('p',`${severityLabels[selected.severity]} · ${statusLabels[selected.status]} · versão ${selected.version}`,'muted'));
  const actions=element('div',undefined,'publish-actions');
  for(const [value,label] of [['claim','Assumir'],['release','Liberar atribuição'],['contain','Marcar contido'],['monitor','Monitorar'],['resolve','Resolver'],['reopen','Reabrir'],['note','Adicionar registro']]){
    const button=element('button',label,'button secondary');button.type='button';button.addEventListener('click',()=>change(value));actions.append(button);
  }
  if(selected.domain==='privacy'){
    const assess=element('button','Avaliar risco','button secondary');assess.type='button';assess.addEventListener('click',assessPrivacy);actions.append(assess);
    const communicate=element('button','Decidir comunicação','button secondary');communicate.type='button';communicate.addEventListener('click',recordCommunication);actions.append(communicate);
  }
  detail.append(actions,element('h4','Histórico'));
  const timeline=element('div',undefined,'phone-list');
  for(const event of result.events){const card=element('article',undefined,'phone-card');card.append(element('strong',event.action),element('p',event.note??'Sem observação'),element('small',new Date(event.created_at).toLocaleString('pt-BR')));timeline.append(card);}
  detail.append(timeline);
}

async function load(){if(!list)return;try{const result=await apiRequest('/v1/admin/incidents');renderList(result.items);}catch(error){feedback.textContent=error.message;}}
async function loadDetail(id){try{renderDetail(await apiRequest(`/v1/admin/incidents/${encodeURIComponent(id)}`));}catch(error){feedback.textContent=error.message;}}
async function change(action,extra={}){
  const note=window.prompt('Registre a justificativa auditável (10 a 2000 caracteres):');if(note===null)return;
  try{await apiRequest(`/v1/admin/incidents/${encodeURIComponent(selected.id)}`,{method:'PATCH',body:{action,note:note.trim(),expectedVersion:selected.version,...extra}});await loadDetail(selected.id);await load();notify('Incidente atualizado e auditado');}catch(error){feedback.textContent=error.message;}
}
async function assessPrivacy(){
  const likelihood=window.prompt('Probabilidade: low, medium ou high','medium');if(likelihood===null)return;
  const impact=window.prompt('Impacto: low, medium, high ou severe','high');if(impact===null)return;
  const affectedScope=window.prompt('Escopo: single_account, multiple_accounts ou unknown','unknown');if(affectedScope===null)return;
  await change('assess_privacy',{assessment:{likelihood:likelihood.trim(),impact:impact.trim(),affectedScope:affectedScope.trim(),containsChildData:window.confirm('O incidente pode envolver dados infantis?'),immediateRisk:window.confirm('Existe risco imediato relevante?'),investigationComplete:window.confirm('A investigação já está completa?')}});
}
async function recordCommunication(){
  const decision=window.prompt('Decisão: preliminary_notice_required, complete_notice_required ou external_notice_not_required','preliminary_notice_required');if(decision===null)return;
  const channelText=window.prompt('Canais separados por vírgula: account, email, anpd (vazio se não comunicar)','account');if(channelText===null)return;
  const legalDeadlineAt=window.prompt('Prazo legal em ISO ou vazio quando ainda não definido','');if(legalDeadlineAt===null)return;
  await change('record_communication',{communication:{decision:decision.trim(),channels:channelText.split(',').map(value=>value.trim()).filter(Boolean),investigationComplete:window.confirm('A investigação está completa?'),legalDeadlineAt:legalDeadlineAt.trim()||null}});
}
form?.addEventListener('submit',async event=>{event.preventDefault();const submit=form.querySelector('[type="submit"]');submit.disabled=true;feedback.textContent='';try{const result=await apiRequest('/v1/admin/incidents',{method:'POST',body:{title:form.elements.title.value.trim(),summary:form.elements.summary.value.trim(),severity:form.elements.severity.value,domain:form.elements.domain.value,idempotencyKey:crypto.randomUUID()}});form.reset();await load();await loadDetail(result.incident.id);notify('Incidente aberto e auditado');}catch(error){feedback.textContent=error.message;}finally{submit.disabled=false;}});
refresh?.addEventListener('click',load);load();
