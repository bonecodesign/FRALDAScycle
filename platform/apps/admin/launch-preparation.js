import {apiRequest} from '/packages/contracts/api-client.js';

const status=document.getElementById('launch-preparation-status');
const list=document.getElementById('launch-preparation-list');
const fields={
  areas:'launch-preparation-areas',requirements:'launch-preparation-requirements',
  tasks:'launch-preparation-tasks',evidence:'launch-preparation-evidence',
};
const set=(id,value)=>{const element=document.getElementById(id);if(element)element.textContent=String(value);};

function valid(result){
  return result?.state==='prepared-not-executed'&&result?.pilotDecision==='NO-GO'
    &&result?.launchAuthorized===false&&result?.founderOnlyNamed===true
    &&result?.summary?.areas===9&&result?.summary?.pendingRequirements===22
    &&result?.summary?.plannedTasks===37&&result?.summary?.requiredEvidence===37
    &&Array.isArray(result?.areas)&&result.areas.length===9
    &&result.areas.every((area,index)=>area?.order===index+1
      &&typeof area.title==='string'&&area.status==='waiting-human-or-external'
      &&Number.isInteger(area.pendingRequirements)&&Number.isInteger(area.plannedTasks)
      &&Number.isInteger(area.requiredEvidence));
}

function render(result){
  set(fields.areas,result.summary.areas);
  set(fields.requirements,result.summary.pendingRequirements);
  set(fields.tasks,result.summary.plannedTasks);
  set(fields.evidence,result.summary.requiredEvidence);
  list.replaceChildren();
  for(const area of result.areas){
    const card=document.createElement('article');
    const content=document.createElement('div');
    const title=document.createElement('strong');
    const detail=document.createElement('p');
    const badge=document.createElement('span');
    card.className='phone-card';
    title.textContent=`${area.order}. ${area.title}`;
    detail.textContent=`${area.pendingRequirements} requisito(s) pendente(s) · ${area.plannedTasks} tarefa(s) · ${area.requiredEvidence} evidência(s) exigida(s)`;
    badge.className='badge warn';
    badge.textContent='Aguardando execução';
    content.append(title,detail);
    card.append(content,badge);
    list.append(card);
  }
  status.textContent='NO-GO mantido: consulta somente leitura, sem autorização de ativação.';
}

async function load(){
  if(!status||!list)return;
  try{
    const result=await apiRequest('/v1/admin/launch-preparation');
    if(!valid(result))throw new Error('Resposta de prontidão inválida.');
    render(result);
  }catch(error){
    list.replaceChildren();
    status.textContent=error?.status===403
      ?'Seu acesso interno não permite consultar a prontidão.'
      :'Prontidão indisponível. O estado seguro permanece NO-GO.';
  }
}

await load();
