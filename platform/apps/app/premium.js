import { apiRequest } from '/packages/contracts/api-client.js';
const feedback = document.getElementById('premium-feedback');
const cancel = document.getElementById('premium-cancel-form');
const choice = document.getElementById('premium-choice-form');
const regularize = document.getElementById('premium-regularize');
const subscribe = document.getElementById('premium-subscribe-form');
let current = null;
function lock(value) { document.querySelectorAll('fieldset,button').forEach(control => { control.disabled = value; }); }
function render(premium) {
  current = premium;
  const labels = { active: 'Premium ativo', grace: 'Prazo de regularização', free: 'Plano gratuito' };
  document.getElementById('premium-state').textContent = `${labels[premium.state]}. ${premium.paidThrough ? 'Período pago até ' + new Date(premium.paidThrough).toLocaleString('pt-BR') + '. ' : ''}${premium.graceThrough ? 'Regularização até ' + new Date(premium.graceThrough).toLocaleString('pt-BR') + '. ' : ''}${premium.renewalEnabled ? 'Próxima renovação habilitada.' : 'Sem próxima renovação habilitada.'}`;
  const notice = document.getElementById('premium-renewal-notice');
  notice.hidden = !premium.renewalFailureNotice;
  notice.textContent = premium.renewalFailureNotice ? `Falha de renovação registrada. Regularize até ${new Date(premium.renewalFailureNotice.regularizeBy).toLocaleString('pt-BR')}. Os benefícios permanecem ativos até esse prazo. Não há cobrança ou retentativa automática nesta versão.` : '';
  const paymentNotice=document.getElementById('premium-payment-notice');paymentNotice.hidden=!premium.initialPaymentNotice;paymentNotice.textContent=premium.initialPaymentNotice?.message??'';
  cancel.hidden = !premium.renewalEnabled;
  subscribe.hidden = (premium.benefitsActive || premium.renewalEnabled) && !premium.renewalFailureNotice;
  subscribe.querySelector('button[type="submit"]').textContent=premium.renewalFailureNotice?'Regularizar com outro cartão':'Assinar por R$ 14,90/mês';
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
async function loadPaymentSdk(tokenization){const existing=document.querySelector('script[data-payment-provider-sdk]');if(existing){if(existing.dataset.ready==='true')return;await new Promise((resolve,reject)=>{existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true})});return;}await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=tokenization.sdkUrl;script.integrity=tokenization.sdkIntegrity;script.crossOrigin='anonymous';script.dataset.paymentProviderSdk='true';script.addEventListener('load',()=>{script.dataset.ready='true';resolve()},{once:true});script.addEventListener('error',()=>reject(new Error('SDK de pagamento indisponível.')),{once:true});document.head.append(script);});}
subscribe.addEventListener('submit',async event=>{event.preventDefault();lock(true);feedback.textContent='Tokenizando o cartão...';try{const session=await apiRequest('/v1/payments/tokenization-sessions',{method:'POST'});await loadPaymentSdk(session.tokenization);const sdk=window.FraldaCyclePaymentProvider;if(!sdk?.tokenizeCard)throw new Error('Tokenização de cartão indisponível.');const data=new FormData(subscribe);const tokenized=await sdk.tokenizeCard({clientToken:session.tokenization.clientToken,pan:data.get('pan'),expires:data.get('expires'),securityCode:data.get('securityCode')});if(typeof tokenized?.token!=='string')throw new Error('Não foi possível tokenizar o cartão.');const keyName='fc.premium.subscription.idempotency';const idempotencyKey=sessionStorage.getItem(keyName)||crypto.randomUUID();sessionStorage.setItem(keyName,idempotencyKey);await apiRequest('/v1/account/premium/subscribe',{method:'POST',body:{paymentMethodToken:tokenized.token,billingCpf:data.get('billingCpf'),idempotencyKey}});sessionStorage.removeItem(keyName);subscribe.reset();feedback.textContent='Assinatura enviada. Os benefícios serão liberados após a confirmação do pagamento.';lock(false);}catch(error){feedback.textContent=error.message;lock(false);}});
load();
