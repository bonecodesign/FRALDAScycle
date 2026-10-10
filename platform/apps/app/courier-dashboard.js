import { apiRequest } from '/packages/contracts/api-client.js';
const history = Boolean(document.getElementById('courier-history-records'));
const list = document.getElementById(history ? 'courier-history-records' : 'courier-deliveries');
const endpoint = history ? '/v1/courier/history' : '/v1/courier/shipments';
const feedback = document.getElementById('courier-feedback');
const refresh = document.getElementById('courier-refresh');
const previousButton = document.getElementById('courier-previous');
const nextButton = document.getElementById('courier-next');
let page=1,hasMore=false;
const states = history ? {delivered:'Entrega registrada como entregue',failed:'Falha na entrega',cancelled:'Entrega cancelada'} : {assigned:'Aguardando coleta',picked_up:'Coleta registrada',in_transit:'Em trânsito'};
const validId = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function confirmedItems(result,target) {
  const items = result?.items;
  if (!Array.isArray(items) || items.length > 50 || items.some(item=>!item || !validId(item.id) || !Object.hasOwn(states,item.status)) || new Set(items.map(item=>item.id.toLowerCase())).size !== items.length) throw new Error('Não foi possível confirmar a lista de entregas.');
  if (result.page!==undefined && result.page!==target) throw new Error('Não foi possível confirmar a página de entregas.');
  return items;
}
async function query(path) {
  const signal = AbortSignal.timeout(15000);
  try {
    const result = await apiRequest(path,{signal});
    if (signal.aborted) throw new Error('Consulta interrompida.');
    return result;
  } catch (error) {
    if (signal.aborted) throw new Error('A consulta demorou para responder. Atualize a lista para tentar novamente.');
    throw error;
  }
}
let pending = false;
const lock = disabled => { refresh.disabled = disabled; if(previousButton)previousButton.disabled=disabled||page<=1; if(nextButton)nextButton.disabled=disabled||!hasMore; list.querySelectorAll('button').forEach(button => button.disabled = disabled); };
async function select(item,details=false) {
  if (pending) return;
  pending = true; lock(true);
  const previous = sessionStorage.getItem('fc.activeShipmentId');
  try {
    const result = await query('/v1/courier/shipments?page='+page);
    const current = confirmedItems(result,page).find(shipment => shipment.id === item.id);
    if (!current || !Object.hasOwn(states,current.status)) throw new Error('A entrega não está mais disponível nesta lista. Atualize suas entregas.');
    if (sessionStorage.getItem('fc.activeShipmentId') !== previous) throw new Error('A entrega ativa mudou. Atualize a lista antes de selecionar novamente.');
    if (sessionStorage.getItem('fc.deliveryProofShipmentId') !== item.id) {
      sessionStorage.removeItem('fc.deliveryProofMediaKey');
      sessionStorage.removeItem('fc.deliveryProofShipmentId');
    }
    sessionStorage.setItem('fc.activeShipmentId',item.id);
    window.location.assign(details ? '/courier/job' : current.status === 'assigned' ? '/app/collection' : '/courier/proof');
  } catch (error) { list.replaceChildren(); hasMore=false; feedback.textContent = (error.message || 'Não foi possível selecionar a entrega.') + ' Atualize a lista antes de selecionar novamente.'; }
  finally { pending = false; lock(false); }
}
async function load(target=1) {
  if (pending) return;
  pending = true; lock(true); list.replaceChildren();
  feedback.textContent = 'Consultando suas entregas...';
  try {
    const result = await query(endpoint+'?page='+target);
    const items = confirmedItems(result,target);
    page=target;hasMore=result.hasMore===true;
    for (const item of items) {
      const panel = document.createElement('div'); panel.className = 'panel';
      const title = document.createElement('p'); title.textContent = 'Entrega ' + item.id;
      const status = document.createElement('p'); status.textContent = states[item.status];
      if (history) {
        const detail = document.createElement('p');
        const modes = {pickup:'Retirada no local',partner:'Entrega por parceiro',postal:'Envio postal',express:'Entrega expressa'};
        const mode = Object.hasOwn(modes,item.mode) ? modes[item.mode] : 'Modalidade não informada';
        const date = typeof item.updatedAt === 'string' ? new Date(item.updatedAt) : null;
        const updated = date && Number.isFinite(date.getTime())
          ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(date)
          : 'Data não informada';
        detail.textContent = mode + ' · Atualizado em: ' + updated;
        panel.append(title,status,detail); list.append(panel); continue;
      }
      const button = document.createElement('button'); button.type = 'button'; button.className = 'button secondary block';
      button.textContent = item.status === 'assigned' ? 'Selecionar para coleta' : 'Selecionar para comprovante';
      button.addEventListener('click',()=>select(item));
      const details = document.createElement('button'); details.type='button'; details.className='button secondary block'; details.textContent='Consultar contato e repasse'; details.addEventListener('click',()=>select(item,true));
      panel.append(title,status,button,details); list.append(panel);
    }
    feedback.textContent = history
      ? (items.length ? 'Histórico carregado. Página ' + page + ' — até 50 registros.' : 'Nenhum registro no histórico da sua conta.')
      : (items.length ? 'Entregas carregadas. Página ' + page + ' — até 50 operações ativas.' : 'Nenhuma entrega ativa atribuída à sua conta.');
  } catch (error) { list.replaceChildren(); hasMore=false; feedback.textContent = error.message || 'Não foi possível consultar suas entregas.'; }
  finally { pending = false; lock(false); }
}
refresh.addEventListener('click',()=>load(1));
previousButton?.addEventListener('click',()=>load(page-1));
nextButton?.addEventListener('click',()=>load(page+1));
void load();
