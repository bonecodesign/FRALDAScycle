import '/apps/admin/auth.js';
import { apiRequest } from '/packages/contracts/api-client.js';
import { createProofReviewController } from './proof-review-controller.js';

const search = document.getElementById('proof-search');
const validation = document.getElementById('proof-validation');
const details = document.getElementById('proof-review-details');
const photo = document.getElementById('proof-review-photo');
const status = document.getElementById('proof-review-status');
const submit = document.getElementById('proof-review-submit');
const controller = createProofReviewController({
  request: apiRequest,
  showPhoto(url) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        photo.onload = null;
        photo.onerror = null;
        photo.removeAttribute('src');
        reject(new Error('A foto demorou para carregar. Consulte novamente.'));
      }, 15000);
      photo.onload = () => { clearTimeout(timer); photo.hidden = false; resolve(); };
      photo.onerror = () => { clearTimeout(timer); photo.hidden = true; reject(new Error('Não foi possível carregar a foto. A validação permanece bloqueada.')); };
      photo.src = url;
    });
  },
});
function reset() {
  controller.clear();
  submit.disabled = true;
  details.hidden = true;
  photo.hidden = true;
  photo.removeAttribute('src');
  validation.reset();
  validation.hidden = false;
}
search.elements.shipment.addEventListener('input', reset);
search.addEventListener('submit', async event => {
  event.preventDefault();
  reset();
  const button = search.querySelector('button');
  button.disabled = true;
  search.elements.shipment.disabled = true;
  status.textContent = 'Consultando comprovante…';
  try {
    const result = await controller.load(search.elements.shipment.value.trim());
    if (!result) return;
    details.hidden = false;
    const { proof } = result;
    const created = new Date(proof.createdAt).toLocaleString('pt-BR');
    document.getElementById('proof-review-metadata').textContent = `Comprovante ${proof.id} · Entregador ${proof.courierId} · ${created} · Aprovação do recebedor: ${proof.approvedAt ? 'registrada' : 'pendente'}.`;
    status.textContent = result.alreadyValidated ? 'Comprovante já validado. Nenhum repasse foi liberado.' : 'Foto carregada. Confira os registros antes de validar.';
    validation.hidden = result.alreadyValidated;
    submit.disabled = result.alreadyValidated;
  } catch (error) {
    reset();
    status.textContent = error.message || 'Não foi possível consultar o comprovante.';
  } finally {
    button.disabled = false;
    search.elements.shipment.disabled = false;
  }
});
validation.addEventListener('submit', async event => {
  event.preventDefault();
  submit.disabled = true;
  status.textContent = 'Registrando validação…';
  search.elements.shipment.disabled = true;
  search.querySelector('button').disabled = true;
  try {
    await controller.validate(validation.elements.reason.value, validation.elements.verified.checked);
    status.textContent = 'Validação registrada. A aprovação do recebedor permanece independente; o repasse não foi liberado.';
    validation.hidden = true;
  } catch (error) {
    reset();
    status.textContent = (error.message || 'Não foi possível registrar.') + ' Consulte a entrega novamente.';
  } finally {
    search.elements.shipment.disabled = false;
    search.querySelector('button').disabled = false;
  }
});
