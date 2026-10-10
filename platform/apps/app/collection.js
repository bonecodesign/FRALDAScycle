import { apiRequest } from '/packages/contracts/api-client.js';
const form = document.getElementById('collection-form');
const feedback = document.getElementById('collection-feedback');
const fieldset = form.querySelector('fieldset');
const next = document.getElementById('collection-next');
let authorized = false;
let pending = false;

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!authorized || pending) return;
  const id = form.elements.shipmentId.value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !form.elements.confirmed.checked) {
    feedback.textContent = 'Informe o identificador válido e confirme a coleta da entrega atribuída.';
    return;
  }
  const previousShipment = sessionStorage.getItem('fc.activeShipmentId');
  pending = true;
  fieldset.disabled = true;
  form.setAttribute('aria-busy', 'true');
  if (next) next.hidden = true;
  try {
    const result = await apiRequest('/v1/shipments/' + encodeURIComponent(id) + '/collection', {
      method: 'POST', body: { confirmed: true, noticeVersion: 'FC-COLLECTION-1' },
    });
    if (result.collection?.id?.toLowerCase() !== id.toLowerCase() || !['picked_up', 'in_transit', 'delivered'].includes(result.collection?.status)) {
      throw new Error('Não foi possível confirmar o registro da coleta. Confira a operação antes de continuar.');
    }
    if (sessionStorage.getItem('fc.activeShipmentId') !== previousShipment) {
      feedback.textContent = 'Coleta registrada. A entrega ativa mudou; selecione a operação correta antes de continuar.';
      return;
    }
    const shipmentId = result.collection.id;
    if (sessionStorage.getItem('fc.deliveryProofShipmentId') !== shipmentId) {
      sessionStorage.removeItem('fc.deliveryProofMediaKey');
      sessionStorage.removeItem('fc.deliveryProofShipmentId');
    }
    sessionStorage.setItem('fc.activeShipmentId', shipmentId);
    form.elements.confirmed.checked = false;
    feedback.textContent = 'Coleta registrada. A operação aguarda entrega, comprovante e aprovação do recebedor.';
    if (next && result.collection.status !== 'delivered') next.hidden = false;
  } catch (error) { feedback.textContent = error.message || 'Não foi possível registrar a coleta.'; }
  finally { pending = false; fieldset.disabled = false; form.removeAttribute('aria-busy'); }
});
apiRequest('/v1/auth/session').then(session => {
  if (!['courier', 'admin'].includes(session.user?.role)) throw new Error('Use a conta do entregador atribuído para registrar a coleta.');
  authorized = true;
  form.elements.shipmentId.value = sessionStorage.getItem('fc.activeShipmentId') || '';
  fieldset.disabled = false;
}).catch(error => { feedback.textContent = error.message; });
