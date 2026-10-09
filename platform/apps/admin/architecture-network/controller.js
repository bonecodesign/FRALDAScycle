import { mountArchitecture } from './viewer.js';

let viewer=null,revision=null,busy=false;
const state=document.getElementById('architecture-access-state');
const view=document.getElementById('architecture-view');
const status=document.getElementById('architecture-sync-status');
const refresh=document.getElementById('architecture-refresh');
const retry=document.getElementById('architecture-retry');
let timer=null;
async function synchronize(){
 if(busy)return;busy=true;refresh.disabled=true;
 try{
  const response=await fetch('/admin/architecture/data',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(response.status===401||response.status===403){
   viewer=null;revision=null;view.hidden=true;
   // Remove the previously authorized graph from this document after access is revoked.
   document.getElementById('graph').innerHTML='';document.getElementById('areas').innerHTML='';document.getElementById('branches').innerHTML='';document.getElementById('connections').innerHTML='';
   retry.hidden=true;state.hidden=false;state.textContent=response.status===401?'Sessão encerrada. Entre novamente no painel administrativo.':'Este módulo é exclusivo de administradores.';
   if(timer)clearInterval(timer);timer=null;const link=document.createElement('a');link.href='/admin/login';link.textContent='Entrar no painel';link.className='button secondary';state.append(document.createElement('br'),link);return;
  }
  if(!response.ok)throw new Error('Não foi possível sincronizar a arquitetura.');
  const graph=await response.json();
  if(!graph.metadata?.revision||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))throw new Error('Mapa indisponível.');
  if(!viewer)viewer=mountArchitecture(graph);else if(revision!==graph.metadata.revision)viewer.update(graph);
  revision=graph.metadata.revision;view.hidden=false;state.hidden=true;retry.hidden=true;
  const mode=graph.metadata.mode==='repository'?'Código local':'Versão da implantação';
  if(!timer)timer=setInterval(()=>{if(!document.hidden)void synchronize();},60000);
  status.textContent=`${mode} · revisão ${revision.slice(0,12)} · conferido às ${new Date().toLocaleTimeString('pt-BR')} · mapa gerado em ${new Date(graph.metadata.generatedAt).toLocaleString('pt-BR')}`;
 }catch(error){
  // Never leave a stale map exposed when the server cannot revalidate access.
  view.hidden=true;retry.hidden=false;state.hidden=false;state.textContent='Não foi possível confirmar o acesso e sincronizar o mapa. Tente novamente.';
 }finally{busy=false;refresh.disabled=false;}
}
refresh.addEventListener('click',synchronize);
retry.addEventListener('click',synchronize);
await synchronize();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void synchronize();});
window.addEventListener('pagehide',()=>{if(timer)clearInterval(timer);timer=null;});
window.addEventListener('pageshow',()=>{if(!document.hidden)void synchronize();});
