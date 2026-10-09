import '/apps/admin/auth.js';
import { apiRequest } from '/packages/contracts/api-client.js';
import { createProofReviewController } from './proof-review-controller.js';

const search = document.getElementById('proof-search');
const validation = document.getElementById('proof-validation');
const details = document.getElementById('proof-review-details');
const photo = document.getElementById('proof-review-photo');
const status = document.getElementById('proof-review-status');
const submit = document.getElementById('proof-review-submit');
const settlementSummary = document.getElementById('proof-settlement-summary');
settlementSummary.insertAdjacentHTML('afterend','<p id="courier-payout-summary" role="status" aria-live="polite"></p><button class="button secondary" id="courier-payout-prepare" type="button" hidden>Preparar obrigação do entregador</button>');
const courierPayoutSummary=document.getElementById('courier-payout-summary'),courierPayoutPrepare=document.getElementById('courier-payout-prepare');
const blockerLabels = {
  unsupported_transaction_kind: 'Fluxo de troca ou doação pendente',
  delivery_proof_pending: 'Entrega ou comprovante pendente',
  transaction_not_eligible: 'Estado da transação impede repasse',
  payment_not_confirmed: 'Pagamento não confirmado ou com inconsistência',
  financial_case_pending: 'Ocorrência financeira requer análise',
  receiver_approval_pending: 'Aprovação do recebedor pendente',
  proof_validation_pending: 'Validação do comprovante pendente',
};
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
  settlementSummary.textContent = '';
  courierPayoutSummary.textContent='';courierPayoutPrepare.hidden=true;courierPayoutPrepare.disabled=false;
}
async function loadCourierPayout(shipmentId){try{const result=await apiRequest(`/v1/shipments/${encodeURIComponent(shipmentId)}/courier-payout`),p=result.payout;courierPayoutSummary.textContent=p.eligible?`Entregador elegível. Estado: ${p.status}. A transferência continua bloqueada até o provedor.`:`Repasse do entregador bloqueado: ${p.blockers.map(code=>blockerLabels[code]||({freight_not_charged:'Frete não cobrado',courier_not_assigned:'Entregador não atribuído'}[code]||'Pendência operacional')).join('; ')}.`;courierPayoutPrepare.hidden=!p.eligible||p.status!=='not_prepared';}catch(error){courierPayoutSummary.textContent=error.message;courierPayoutPrepare.hidden=true;}}
courierPayoutPrepare.addEventListener('click',async()=>{const shipment=search.elements.shipment.value.trim();courierPayoutPrepare.disabled=true;try{const result=await apiRequest(`/v1/shipments/${encodeURIComponent(shipment)}/courier-payout`,{method:'POST',body:{confirmed:true}}),p=result.payout;courierPayoutSummary.textContent=`Obrigação preparada: R$ ${(p.courier_amount_cents/100).toFixed(2).replace('.',',')} ao entregador; estado provider_pending. Nenhuma transferência executada.`;courierPayoutPrepare.hidden=true;}catch(error){courierPayoutSummary.textContent=error.message;courierPayoutPrepare.disabled=false;}});
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
    await loadCourierPayout(search.elements.shipment.value.trim());
    details.hidden = false;
    const { proof } = result;
    const settlement = result.settlement;
    if (settlement) {
      const blockers = settlement.blockers.map(code => blockerLabels[code] || 'Pendência para análise').join('; ');
      const deadline = settlement.targetDeadline
        ? ` Prazo alvo: ${new Date(settlement.targetDeadline).toLocaleString('pt-BR')}, sujeito à homologação do fornecedor.${settlement.targetOverdue ? ' Prazo alvo ultrapassado.' : ''}` : '';
      settlementSummary.textContent = (settlement.requirementsMet
        ? 'Requisitos internos do vendedor atendidos nesta consulta.'
        : `Pendências do repasse ao vendedor: ${blockers}.`) + deadline + ' Transferência não autorizada: integração de repasse pendente.';
    }
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
    settlementSummary.textContent = 'Validação registrada. Consulte novamente para atualizar as pendências do vendedor. Transferência não autorizada.';
  } catch (error) {
    reset();
    status.textContent = (error.message || 'Não foi possível registrar.') + ' Consulte a entrega novamente.';
  } finally {
    search.elements.shipment.disabled = false;
    search.querySelector('button').disabled = false;
  }
});
