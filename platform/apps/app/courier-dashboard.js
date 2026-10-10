import { apiRequest } from '/packages/contracts/api-client.js';
const history = Boolean(document.getElementById('courier-history-records'));
const list = document.getElementById(history ? 'courier-history-records' : 'courier-deliveries');
const endpoint = history ? '/v1/courier/history' : '/v1/courier/shipments';
const feedback = document.getElementById('courier-feedback');
const refresh = document.getElementById('courier-refresh');
const states = history ? {delivered:'Entrega registrada como entregue',failed:'Falha na entrega',cancelled:'Entrega cancelada'} : {assigned:'Aguardando coleta',picked_up:'Coleta registrada',in_transit:'Em trânsito'};
const validId = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
let pending = false;
const lock = disabled => { refresh.disabled = disabled; list.querySelectorAll('button').forEach(button => button.disabled = disabled); };
async function select(item) {
  if (pending) return;
  pending = true; lock(true);
  const previous = sessionStorage.getItem('fc.activeShipmentId');
  try {
    const result = await apiRequest('/v1/courier/shipments');
    const current = Array.isArray(result.items) ? result.items.find(shipment => shipment?.id === item.id) : null;
    if (!current || !Object.hasOwn(states,current.status)) throw new Error('A entrega não está mais disponível nesta lista. Atualize suas entregas.');
    if (sessionStorage.getItem('fc.activeShipmentId') !== previous) throw new Error('A entrega ativa mudou. Atualize a lista antes de selecionar novamente.');
    if (sessionStorage.getItem('fc.deliveryProofShipmentId') !== item.id) {
      sessionStorage.removeItem('fc.deliveryProofMediaKey');
      sessionStorage.removeItem('fc.deliveryProofShipmentId');
    }
    sessionStorage.setItem('fc.activeShipmentId',item.id);
    window.location.assign(current.status === 'assigned' ? '/app/collection' : '/courier/proof');
  } catch (error) { feedback.textContent = error.message || 'Não foi possível selecionar a entrega.'; }
  finally { pending = false; lock(false); }
}
async function load() {
  if (pending) return;
  pending = true; lock(true); list.replaceChildren();
  feedback.textContent = 'Consultando suas entregas...';
  try {
    const {items} = await apiRequest(endpoint);
    if (!Array.isArray(items) || items.length > 50 || items.some(item=>!item || !validId(item.id) || !Object.hasOwn(states,item.status))) throw new Error('Não foi possível confirmar a lista de entregas.');
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
      button.addEventListener('click',()=>select(item)); panel.append(title,status,button); list.append(panel);
    }
    feedback.textContent = history
      ? (items.length ? 'Histórico carregado. Exibindo até 50 registros mais recentes.' : 'Nenhum registro no histórico da sua conta.')
      : (items.length ? 'Entregas carregadas. Exibindo até 50 operações ativas mais recentes.' : 'Nenhuma entrega ativa atribuída à sua conta.');
  } catch (error) { list.replaceChildren(); feedback.textContent = error.message || 'Não foi possível consultar suas entregas.'; }
  finally { pending = false; lock(false); }
}
refresh.addEventListener('click',load);
void load();
