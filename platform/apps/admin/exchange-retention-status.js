import {apiRequest} from '/packages/contracts/api-client.js';

const dateTime=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}),labels={healthy:'Normal',attention:'Atenção',awaiting_first_run:'Aguardando primeira execução'};
const set=(id,value)=>{const element=document.getElementById(id);if(element)element.textContent=value;};
const refresh=document.getElementById('retention-status-refresh');let loading=false,timer=null;
function renderHistory(items){const list=document.getElementById('retention-status-history'),empty=document.getElementById('retention-status-history-empty');if(!list||!empty)return;list.replaceChildren();for(const item of items.slice(0,30)){const article=document.createElement('article'),content=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('p');article.className='phone-card';title.textContent=item.result==='success'?'Concluída':'Falhou';detail.textContent=`${dateTime.format(new Date(item.ranAt))} · ${Number(item.anonymizedCount)} registro(s) anonimizado(s)`;content.append(title,detail);article.append(content);list.append(article);}empty.hidden=items.length>0;}
async function load(){if(loading||document.hidden)return;loading=true;if(refresh)refresh.disabled=true;const feedback=document.getElementById('retention-status-feedback');try{const result=await apiRequest('/v1/admin/exchange-retention-status');set('retention-status-state',labels[result.state]??'Indisponível');set('retention-status-last',result.lastRunAt?dateTime.format(new Date(result.lastRunAt)):'Nenhuma execução registrada');set('retention-status-next',dateTime.format(new Date(result.nextRunAt)));set('retention-status-failures',String(result.consecutiveFailures));set('retention-status-level',result.notifiedAccessLevel==null?'Nenhum':`Nível ${result.notifiedAccessLevel}`);renderHistory(Array.isArray(result.history)?result.history:[]);feedback.textContent=result.sensitiveDataIncluded===false?'Consulta sem dados pessoais ou financeiros.':'Resposta de segurança inválida.';}catch(error){set('retention-status-state','Indisponível');feedback.textContent=error.status===403?'Acesso mínimo de nível 2 necessário.':'Não foi possível consultar a rotina de retenção.';}finally{loading=false;if(refresh)refresh.disabled=false;}}
function stop(){if(timer!==null){clearInterval(timer);timer=null;}}
function start(){stop();if(!document.hidden)timer=setInterval(load,60_000);}
refresh?.addEventListener('click',load);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else{void load();start();}});
window.addEventListener('pagehide',stop,{once:true});
await load();
start();

