import {apiRequest} from '/packages/contracts/api-client.js';

const dateTime=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}),labels={healthy:'Normal',attention:'Atenção',awaiting_first_run:'Aguardando primeira execução'};
const set=(id,value)=>{const element=document.getElementById(id);if(element)element.textContent=value;};
async function load(){const feedback=document.getElementById('retention-status-feedback');try{const result=await apiRequest('/v1/admin/exchange-retention-status');set('retention-status-state',labels[result.state]??'Indisponível');set('retention-status-last',result.lastRunAt?dateTime.format(new Date(result.lastRunAt)):'Nenhuma execução registrada');set('retention-status-next',dateTime.format(new Date(result.nextRunAt)));set('retention-status-failures',String(result.consecutiveFailures));set('retention-status-level',result.notifiedAccessLevel==null?'Nenhum':`Nível ${result.notifiedAccessLevel}`);feedback.textContent=result.sensitiveDataIncluded===false?'Consulta sem dados pessoais ou financeiros.':'Resposta de segurança inválida.';}catch(error){set('retention-status-state','Indisponível');feedback.textContent=error.status===403?'Acesso mínimo de nível 2 necessário.':'Não foi possível consultar a rotina de retenção.';}}
await load();

