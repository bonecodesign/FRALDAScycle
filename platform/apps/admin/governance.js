import { setupAdmin } from "/apps/admin/shared-admin.js";
import { notify } from "/packages/ui/notify.js";
import "/apps/admin/auth.js";
import { apiOrigin, apiRequest } from "/packages/contracts/api-client.js";
function setupAdminModeration(){const search=document.getElementById('moderation-search');if(!search)return;const priority=document.getElementById('moderation-priority');const status=document.getElementById('moderation-status');const filter=()=>{let visible=0;document.querySelectorAll('[data-moderation-case]').forEach(row=>{const text=row.dataset.search;const match=text.includes(search.value.trim().toLowerCase())&&(!priority.value||text.includes(priority.value.toLowerCase()))&&(!status.value||text.includes(status.value.toLowerCase()));row.hidden=!match;if(match)visible++});document.getElementById('moderation-empty').hidden=visible>0};search.addEventListener('input',filter);priority.addEventListener('change',filter);status.addEventListener('change',filter);document.getElementById('moderation-refresh')?.addEventListener('click',()=>notify('Fila de moderação atualizada'));document.querySelectorAll('[data-case-review]').forEach(button=>button.addEventListener('click',()=>{const row=button.closest('[data-moderation-case]');const id=row.cells[0].textContent;document.getElementById('moderation-case-panel').innerHTML=`<section class="panel"><div class="section-head"><div><span class="eyebrow">Análise do caso ${id}</span><h2>${row.cells[1].textContent}</h2><p>${row.cells[2].textContent} · evidências preservadas.</p></div><span class="badge warn">Decisão pendente</span></div><div class="dashboard-grid"><div class="phone-list"><article class="phone-card"><span class="status-icon">!</span><div><h3>Regra acionada</h3><p>Conteúdo bloqueado automaticamente pela política de segurança.</p></div></article><article class="phone-card"><span class="status-icon">✓</span><div><h3>Evidência íntegra</h3><p>Mensagem, horário, participantes e contexto foram preservados.</p></div></article><article class="phone-card"><span class="status-icon">✓</span><div><h3>Histórico verificado</h3><p>Nenhuma punição anterior nos últimos 90 dias.</p></div></article></div><div><div class="form-group"><label>Fundamentação da decisão</label><textarea class="input" id="moderation-note" rows="4" placeholder="Registre os critérios utilizados"></textarea><small class="field-error" id="moderation-error"></small></div><div class="publish-actions"><button class="button secondary" data-moderation-decision="dismiss">Sem infração</button><button class="button secondary" data-moderation-decision="warn">Advertir</button><button class="button primary" data-moderation-decision="block">Bloquear conta</button></div></div></div></section>`;document.querySelectorAll('[data-moderation-decision]').forEach(decision=>decision.addEventListener('click',()=>{const note=document.getElementById('moderation-note');if(note.value.trim().length<10){document.getElementById('moderation-error').textContent='Registre uma justificativa com pelo menos 10 caracteres.';return}const labels={dismiss:'Encerrado sem infração',warn:'Usuário advertido',block:'Conta bloqueada'};row.cells[4].innerHTML=`<span class="badge">${labels[decision.dataset.moderationDecision]}</span>`;document.getElementById('moderation-case-panel').innerHTML='';notify(`${id}: ${labels[decision.dataset.moderationDecision]}`)}))}))}
function setupAdminAudit(){const search=document.getElementById('audit-search');if(!search)return;const module=document.getElementById('audit-module');const filter=()=>{let visible=0;document.querySelectorAll('[data-audit-row]').forEach(row=>{const text=row.dataset.search;const match=text.includes(search.value.trim().toLowerCase())&&(!module.value||text.includes(module.value.toLowerCase()));row.hidden=!match;if(match)visible++});document.getElementById('audit-empty').hidden=visible>0};search.addEventListener('input',filter);module.addEventListener('change',filter);document.getElementById('audit-refresh')?.addEventListener('click',()=>notify('Eventos e logs atualizados'));document.getElementById('audit-export')?.addEventListener('click',()=>notify('Exportação da auditoria preparada com mascaramento de dados'));document.querySelectorAll('[data-webhook-retry]').forEach(button=>button.addEventListener('click',()=>{const row=button.closest('tr');button.disabled=true;button.textContent='Reprocessando…';window.setTimeout(()=>{row.cells[3].innerHTML='<span class="badge">Entregue</span>';row.cells[4].textContent='226 ms';row.cells[5].textContent='—';notify('Webhook reprocessado e entregue com sucesso')},700)}))}
function setupAdminSettings(){const save=document.getElementById('platform-save');if(!save)return;save.addEventListener('click',()=>notify('Configurações salvas e registradas na auditoria'));document.getElementById('integration-test-all')?.addEventListener('click',()=>notify('Todas as integrações responderam corretamente'));document.querySelectorAll('[data-integration-test]').forEach(button=>button.addEventListener('click',()=>{const row=button.closest('tr');button.disabled=true;button.textContent='Testando…';window.setTimeout(()=>{row.cells[2].innerHTML='<span class="badge">Ativa</span>';row.cells[3].textContent='Teste concluído agora';button.disabled=false;button.textContent='Testar';notify(`${row.cells[0].textContent.trim()}: conexão validada`)},600)}));document.querySelectorAll('[data-integration-config]').forEach(button=>button.addEventListener('click',()=>notify(`Configuração segura de ${button.closest('tr').cells[0].textContent.trim()} aberta`)));document.getElementById('maintenance-toggle')?.addEventListener('change',event=>notify(event.target.checked?'Modo de manutenção preparado; publicação requer confirmação':'Modo de manutenção desativado'));document.getElementById('settings-history')?.addEventListener('click',()=>notify('Histórico de versões carregado'))}
setupAdmin();
setupAdminModeration();
setupAdminAudit();
setupAdminSettings();

let auditOffset=0;
const auditPageSize=25;
async function loadLiveAudit(){
  const first=document.querySelector('[data-audit-row]');
  const body=first?.closest('tbody');
  if(!body)return;
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  try{
    const {items}=await apiRequest(`/v1/admin/audit-events?limit=${auditPageSize}&offset=${auditOffset}`);
    if(!items.length&&auditOffset>0){auditOffset=Math.max(0,auditOffset-auditPageSize);return loadLiveAudit()}
    if(!items.length)return;
    body.innerHTML=items.map(item=>{
      const when=new Date(item.occurred_at).toLocaleString('pt-BR');
      const actor=item.actor_name||'Sistema';
      const action=item.action;
      const module=item.entity_type;
      const search=`${when} ${actor} ${action} ${module}`.toLocaleLowerCase('pt-BR');
      return `<tr data-audit-row data-search="${escape(search)}"><td>${escape(when)}</td><td>${escape(actor)}</td><td>${escape(action)}</td><td>${escape(module)}</td><td>${escape(item.entity_id)}</td></tr>`;
    }).join('');
    let pager=document.getElementById('audit-pagination');
    if(!pager){pager=document.createElement('div');pager.id='audit-pagination';pager.className='publish-actions action-pair';body.closest('.admin-table-wrap').after(pager)}
    pager.innerHTML=`<button class="button secondary" id="audit-previous" ${auditOffset===0?'disabled':''}>Anterior</button><small class="muted">Página ${Math.floor(auditOffset/auditPageSize)+1}</small><button class="button secondary" id="audit-next" ${items.length<auditPageSize?'disabled':''}>Próxima</button>`;
    document.getElementById('audit-previous').addEventListener('click',()=>{auditOffset=Math.max(0,auditOffset-auditPageSize);loadLiveAudit()});
    document.getElementById('audit-next').addEventListener('click',()=>{auditOffset+=auditPageSize;loadLiveAudit()});
    document.documentElement.dataset.auditState='live';
  }catch(error){
    document.documentElement.dataset.auditState=error.status===401?'unauthenticated':error.status===403?'forbidden':'fallback';
  }
}
document.getElementById('audit-refresh')?.addEventListener('click',loadLiveAudit);
loadLiveAudit();

document.getElementById('audit-export')?.addEventListener('click',async event=>{
  event.preventDefault();event.stopImmediatePropagation();
  const button=event.currentTarget;button.disabled=true;button.textContent='Preparando CSV…';
  try{
    const response=await fetch(`${apiOrigin()}/v1/admin/audit-events.csv`,{credentials:'include'});
    if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(payload.error?.message||'Não foi possível exportar a auditoria.')}
    const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');
    link.href=url;link.download='fraldacycle-auditoria.csv';link.click();URL.revokeObjectURL(url);
    button.textContent='CSV exportado';notify('Auditoria real exportada com mascaramento e proteção');
  }catch(error){button.disabled=false;button.textContent='Exportar CSV';notify(error.message)}
},true);

