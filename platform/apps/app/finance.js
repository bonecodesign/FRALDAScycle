import { setupWalletLogisticsExtras } from "/apps/app/action-states.js";
import { notify } from "/packages/ui/notify.js";
import "/packages/ui/iconography.js";
import { apiRequest } from "/packages/contracts/api-client.js";

function setupPaymentFlow(){
  const content=document.getElementById('payment-content');
  if(content){const options=[...content.querySelectorAll('input[name="pay"]')];const detail=document.getElementById('payment-method-detail');const error=document.getElementById('payment-error');const submit=document.getElementById('payment-submit');const draw=method=>{const views={pix:'<div class="payment-method-panel"><span class="feedback-icon success">◇</span><div><strong>Pix</strong><p>O provedor gerará a cobrança após a confirmação.</p></div></div>',credit:'<div class="payment-method-panel payment-fields"><div class="form-group"><label>Número do cartão</label><input class="input" inputmode="numeric" maxlength="19" placeholder="0000 0000 0000 0000"></div><div class="form-row"><div class="form-group"><label>Validade</label><input class="input" maxlength="5" placeholder="MM/AA"></div><div class="form-group"><label>CVV</label><input class="input" inputmode="numeric" maxlength="3" placeholder="000"></div></div></div>',wallet:'<div class="payment-method-panel warning-panel"><span class="feedback-icon warning">!</span><div><strong>Carteira indisponível</strong><p>O saldo da conta ainda não pode ser consultado ou utilizado.</p></div></div>'};detail.innerHTML=views[method];error.textContent='';submit.dataset.method=method;submit.dataset.invalid=method==='wallet'?'true':'false';submit.disabled=method==='wallet';submit.textContent='Confirmar pagamento'};options.forEach(option=>option.addEventListener('change',()=>draw(option.value)));draw(options.find(option=>option.checked)?.value||'pix');submit.addEventListener('click',event=>{const method=submit.dataset.method;if(method==='wallet'){event.preventDefault();event.stopImmediatePropagation();error.textContent='A carteira ainda não está disponível para pagamentos.';return}if(method==='credit'){const fields=[...detail.querySelectorAll('input')];if(fields.some(field=>!field.value.trim())){event.preventDefault();event.stopImmediatePropagation();error.textContent='Preencha todos os dados do cartão.';fields.forEach(field=>field.classList.toggle('invalid',!field.value.trim()))}}},true)}
  const receipt=document.getElementById('receipt-submit');
  receipt?.addEventListener('click',()=>notify('O comprovante estará disponível quando esta tela carregar uma transação real.'))
}
function setupWallet(){
  const content=document.getElementById('wallet-content');if(!content)return;
  const open=document.getElementById('wallet-add-submit');const panel=document.getElementById('wallet-add-panel');const filter=document.getElementById('wallet-filter');
  filter?.addEventListener('change',()=>{content.querySelectorAll('[data-kind]').forEach(row=>row.hidden=filter.value!=='all'&&row.dataset.kind!==filter.value)});
  open?.addEventListener('click',()=>{panel.innerHTML='<div class="wallet-add-card"><h2>Adicionar saldo</h2><p>Recarga de carteira ainda não está disponível. Nenhum valor foi cobrado ou creditado.</p></div>';open.hidden=true});
  document.querySelectorAll('[data-action="edit-ad"]').forEach(button=>button.addEventListener('click',()=>notify('Edição do anúncio aberta')));
}

function setupRealPaymentCases(){
  const intentId=sessionStorage.getItem('fc.paymentIntentId');
  const submitCase=async(kind,reason,details,button,error,onSuccess)=>{if(!intentId){error.textContent='Pagamento não identificado. Abra esta opção pelo histórico da carteira.';return}const keyName='fc.paymentCase.'+kind+'.'+intentId;const idempotencyKey=sessionStorage.getItem(keyName)||crypto.randomUUID();sessionStorage.setItem(keyName,idempotencyKey);const original=button.textContent;button.disabled=true;button.innerHTML='<span class="inline-spinner"></span> Enviando...';error.textContent='';try{await apiRequest('/v1/payments/'+intentId+'/'+(kind==='refund'?'refunds':'disputes'),{method:'POST',body:{idempotencyKey,reason,details}});onSuccess()}catch(cause){error.textContent=cause.message||'Não foi possível registrar a solicitação.';button.disabled=false;button.textContent=original}};
  const refundButton=document.getElementById('refund-submit');const refundDetails=document.getElementById('refund-description');const refundError=document.getElementById('refund-error');const refundContent=document.getElementById('refund-content');
  refundButton?.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();const details=refundDetails.value.trim();if(details.length<10){refundError.textContent='Descreva a situação com pelo menos 10 caracteres.';return}void submitCase('refund','customer_request',details,refundButton,refundError,()=>{refundContent.innerHTML='<a class="back-link-inline" href="/app/wallet">← Carteira</a><div class="ui-state success-state"><div class="state-icon success">✓</div><span class="eyebrow">Solicitação recebida</span><h1>Reembolso em análise</h1><p>Registramos sua solicitação e você receberá atualizações no app.</p><div class="notice">Prazo médio: até 7 dias úteis.</div><a class="button primary block" href="/app/wallet">Voltar para a carteira</a></div>';notify('Solicitação enviada com sucesso')})},true);
  const disputeButton=document.getElementById('dispute-submit');const disputeReason=document.getElementById('dispute-reason');const disputeDetails=document.getElementById('dispute-details');const disputeError=document.getElementById('dispute-error');const disputeContent=document.getElementById('dispute-content');
  disputeButton?.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();const reason=disputeReason.value;const details=disputeDetails.value.trim();if(!reason||details.length<10){disputeError.textContent='Selecione o motivo e descreva o ocorrido com pelo menos 10 caracteres.';return}void submitCase('dispute',reason,details,disputeButton,disputeError,()=>{disputeContent.innerHTML='<a class="back-link-inline" href="/app/wallet">← Carteira</a><div class="ui-state success-state"><div class="state-icon success">✓</div><span class="eyebrow">Mediação iniciada</span><h1>Disputa registrada</h1><p>O valor permanece protegido enquanto a equipe analisa as evidências.</p><div class="notice">Retorno estimado em até 2 dias úteis.</div><a class="button primary block" href="/app/wallet">Voltar à carteira</a></div>';notify('Disputa enviada para mediação')})},true)
}

async function loadPaymentSdk(tokenization){
  const existing=document.querySelector('script[data-payment-provider-sdk]');
  if(existing){if(existing.dataset.ready==='true')return;await new Promise((resolve,reject)=>{existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true})});return}
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=tokenization.sdkUrl;script.integrity=tokenization.sdkIntegrity;script.crossOrigin='anonymous';script.dataset.paymentProviderSdk='true';script.addEventListener('load',()=>{script.dataset.ready='true';resolve()},{once:true});script.addEventListener('error',()=>reject(new Error('SDK de pagamento indisponível.')),{once:true});document.head.append(script)})
}

function setupRealPayments(){
  const submit=document.getElementById('payment-submit');
  const detail=document.getElementById('payment-method-detail');
  const error=document.getElementById('payment-error');
  if(!submit||!detail||!error)return;
  const ensureBillingCpf=()=>{
    if(submit.dataset.method!=='credit'||detail.querySelector('[name="billingCpf"]'))return;
    const wrapper=document.createElement('div');wrapper.className='form-group billing-identity';
    wrapper.innerHTML='<label>CPF da cobrança</label><input class="input" name="billingCpf" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00"><small>Deve coincidir com o CPF cadastrado. Isso não comprova a titularidade do cartão.</small>';
    detail.append(wrapper);
  };
  document.querySelectorAll('input[name="pay"]').forEach(option=>option.addEventListener('change',ensureBillingCpf));
  ensureBillingCpf();
  submit.addEventListener('click',async event=>{
    const method=submit.dataset.method;if(method==='wallet')return;
    event.preventDefault();event.stopImmediatePropagation();
    const transactionId=sessionStorage.getItem('fc.activeTransactionId');
    if(!transactionId){error.textContent='Retorne à negociação e selecione o pedido que deseja pagar.';return}
    const original=submit.textContent;submit.disabled=true;submit.innerHTML='<span class="inline-spinner"></span> Preparando pagamento...';error.textContent='';
    try{
      let paymentMethodToken,billingCpf;
      if(method==='credit'){
        ensureBillingCpf();
        const fields=[...detail.querySelectorAll('input:not([name="billingCpf"])')];
        const cpfField=detail.querySelector('[name="billingCpf"]');
        if(fields.length!==3||fields.some(field=>!field.value.trim())||!cpfField?.value.trim())throw new Error('Preencha os dados do cartão e o CPF da cobrança.');
        const session=await apiRequest('/v1/payments/tokenization-sessions',{method:'POST'});await loadPaymentSdk(session.tokenization);
        const sdk=window.FraldaCyclePaymentProvider;if(!sdk?.tokenizeCard)throw new Error('Tokenização de cartão indisponível.');
        const tokenized=await sdk.tokenizeCard({clientToken:session.tokenization.clientToken,pan:fields[0].value,expires:fields[1].value,securityCode:fields[2].value});
        if(typeof tokenized?.token!=='string')throw new Error('Não foi possível tokenizar o cartão.');
        paymentMethodToken=tokenized.token;billingCpf=cpfField.value;
      }
      const keyName='fc.paymentIdempotency.'+transactionId;const idempotencyKey=sessionStorage.getItem(keyName)||crypto.randomUUID();sessionStorage.setItem(keyName,idempotencyKey);
      const result=await apiRequest('/v1/payments/intents',{method:'POST',body:{transactionId,idempotencyKey,method,paymentMethodToken,billingCpf,deliveryRequested:sessionStorage.getItem('fc.deliveryRequested')==='true'}});
      sessionStorage.setItem('fc.paymentIntentId',result.intent.id);window.location.assign('/app/payment-success');
    }catch(cause){error.textContent=cause.message||'Não foi possível concluir o pagamento.';submit.disabled=false;submit.textContent=original}
  },true)
}

if (document.getElementById("payment-success-content")) sessionStorage.setItem("fc.paymentConfirmed", "true");

setupPaymentFlow();
setupRealPayments();
setupWallet();
setupRealPaymentCases();
setupWalletLogisticsExtras();

