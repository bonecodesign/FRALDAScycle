import { apiRequest } from '/packages/contracts/api-client.js';
const feedback = document.getElementById('premium-feedback');
const cancel = document.getElementById('premium-cancel-form');
const choice = document.getElementById('premium-choice-form');
const regularize = document.getElementById('premium-regularize');
let current = null;
function lock(value) { document.querySelectorAll('fieldset,button').forEach(control => { control.disabled = value; }); }
function render(premium) {
  current = premium;
  const labels = { active: 'Premium ativo', grace: 'Prazo de regularização', free: 'Plano gratuito' };
  document.getElementById('premium-state').textContent = `${labels[premium.state]}. ${premium.paidThrough ? 'Período pago até ' + new Date(premium.paidThrough).toLocaleString('pt-BR') + '. ' : ''}${premium.graceThrough ? 'Regularização até ' + new Date(premium.graceThrough).toLocaleString('pt-BR') + '. ' : ''}${premium.renewalEnabled ? 'Próxima renovação habilitada no registro; cobrança indisponível.' : 'Sem próxima renovação habilitada.'}`;
  cancel.hidden = !premium.renewalEnabled;
  choice.hidden = !premium.benefitsActive;
  regularize.hidden = premium.benefitsActive;
  const choices = document.getElementById('premium-choices'); choices.replaceChildren();
  const listings = document.getElementById('premium-listings'); listings.replaceChildren();
  if (premium.choice.selectedIds === null) {
    const note = document.createElement('p'); note.textContent = 'Nenhuma escolha registrada: será usado o critério dos três mais recentes. Salvar sem marcar anúncios escolhe pausar todos os elegíveis.'; choices.append(note);
  }
  for (const listing of premium.listings) {
    const row = document.createElement('article'); row.className = 'phone-card';
    const title = document.createElement('p'); title.textContent = `${listing.title} — ${listing.status}${listing.ongoingTransaction ? ' (operação em andamento)' : ''}`; row.append(title);
    if (!listing.ongoingTransaction && ['published','paused'].includes(listing.status)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'button secondary small';
      const status = listing.status === 'published' ? 'paused' : 'published';
      button.textContent = status === 'paused' ? 'Pausar anúncio' : 'Retomar anúncio';
      button.setAttribute('aria-label', `${button.textContent}: ${listing.title}`);
      button.addEventListener('click', () => update('/v1/account/premium/listing-status', { listingId: listing.id, status, expectedStatus: listing.status }, 'POST', 'Estado do anúncio atualizado.'));
      row.append(button);
      if (listing.status === 'published') {
        const label = document.createElement('label'); const input = document.createElement('input');
        input.type = 'checkbox'; input.name = 'selectedIds'; input.value = listing.id;
        input.checked = premium.choice.selectedIds?.includes(listing.id) ?? false;
        label.append(input, document.createTextNode(' ' + listing.title)); choices.append(label);
      }
    }
    listings.append(row);
  }
  if (!premium.listings.length) listings.textContent = 'Nenhum anúncio na conta.';
}
async function load(message = 'Plano e anúncios carregados.') {
  lock(true);
  try { render((await apiRequest('/v1/account/premium')).premium); lock(false); feedback.textContent = message; }
  catch (error) { current = null; feedback.textContent = error.message; document.getElementById('premium-refresh').disabled = false; }
}
async function update(path, body, method, message) {
  lock(true); feedback.textContent = 'Registrando...';
  try { await apiRequest(path, { method, body }); await load(message); }
  catch (error) { current = null; feedback.textContent = error.message + ' Carregue novamente para continuar.'; document.getElementById('premium-refresh').disabled = false; }
}
document.getElementById('premium-refresh').addEventListener('click', () => load());
cancel.addEventListener('submit', event => {
  event.preventDefault(); if (current && cancel.elements.confirmed.checked) update('/v1/account/premium/cancel-renewal', { confirmed: true }, 'POST', 'Próxima renovação cancelada. Período pago preservado.');
});
choice.addEventListener('submit', event => {
  event.preventDefault(); if (!current) return;
  const selectedIds = [...choice.querySelectorAll('input:checked')].map(input => input.value);
  if (selectedIds.length > 3) { feedback.textContent = 'Escolha no máximo três anúncios.'; return; }
  update('/v1/account/premium/listing-choice', { selectedIds, expectedVersion: current.choice.version }, 'PUT', 'Escolha registrada.');
});
regularize.addEventListener('click', () => { if (current) update('/v1/account/premium/regularize-listings', { confirmed: true }, 'POST', 'Limite gratuito aplicado; operações em andamento preservadas.'); });
load();
