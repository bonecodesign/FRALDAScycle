function notify(message){const toast=document.querySelector("#toast");if(!toast)return;toast.textContent=message;toast.classList.add("show");window.setTimeout(()=>toast.classList.remove("show"),1800)}
function actionMessage(action){return {favorite:'Adicionado aos favoritos',search:'128 resultados encontrados',send:'Mensagem enviada',pay:'Pagamento aprovado e protegido',receipt:'Comprovante preparado para visualização',delivery:'Recebimento confirmado',publish:'Opção selecionada. Avançando para a próxima etapa',invite:'Convite enviado',export:'Relatório preparado para exportação','read-all':'Todas as notificações foram marcadas como lidas','add-balance':'Opções para adicionar saldo abertas',refund:'Solicitação de reembolso enviada','delivery-problem':'Atendimento de entrega iniciado',rating:'Avaliação enviada com sucesso','publish-complete':'Anúncio publicado com sucesso'}[action]||'Ação concluída'}
function setupNotifications(){
  const list=document.getElementById('notification-list');
  if(!list)return;
  const items=[...list.querySelectorAll('[data-notification-item]')];
  const filters=[...document.querySelectorAll('[data-notification-filter]')];
  const unreadOnly=document.getElementById('notification-unread-only');
  const empty=document.getElementById('notification-empty');
  const count=document.getElementById('notification-count');
  const readAll=document.getElementById('notification-read-all');
  let activeFilter='all';
  const updateCount=()=>{
    const unread=items.filter(item=>item.classList.contains('unread')).length;
    count.textContent=String(unread);
    count.setAttribute('aria-label',`${unread} ${unread===1?'notificação não lida':'notificações não lidas'}`);
    count.classList.toggle('is-zero',unread===0);
    readAll.disabled=unread===0;
    readAll.textContent=unread===0?'Todas as notificações foram lidas':'Marcar todas como lidas';
  };
  const applyFilters=()=>{
    let visible=0;
    items.forEach(item=>{
      const typeMatches=activeFilter==='all'||item.dataset.notificationType===activeFilter;
      const unreadMatches=!unreadOnly.checked||item.classList.contains('unread');
      const show=typeMatches&&unreadMatches;
      item.classList.toggle('hidden',!show);
      if(show)visible+=1;
    });
    empty.classList.toggle('hidden',visible>0);
  };
  const markRead=item=>{
    item.classList.remove('unread');
    const action=item.querySelector('[data-notification-read]');
    if(action)action.replaceWith(Object.assign(document.createElement('span'),{className:'notification-read-label',textContent:'Lida'}));
    updateCount();
    applyFilters();
  };
  filters.forEach(button=>button.addEventListener('click',()=>{
    activeFilter=button.dataset.notificationFilter;
    filters.forEach(filter=>filter.classList.toggle('active',filter===button));
    applyFilters();
  }));
  unreadOnly.addEventListener('change',applyFilters);
  list.querySelectorAll('[data-notification-read]').forEach(button=>button.addEventListener('click',()=>markRead(button.closest('[data-notification-item]'))));
  readAll.addEventListener('click',()=>{
    items.filter(item=>item.classList.contains('unread')).forEach(markRead);
    notify('Todas as notificações foram marcadas como lidas');
  });
  updateCount();
  applyFilters();
}
function setupNotificationSettings(){
  const form=document.getElementById('notification-settings-form');
  if(!form)return;
  const quietToggle=document.getElementById('quiet-hours-enabled');
  const quietFields=document.getElementById('quiet-hours-fields');
  const status=document.getElementById('notification-settings-status');
  const reset=document.getElementById('notification-settings-reset');
  const syncQuietHours=()=>{quietFields.hidden=!quietToggle.checked};
  quietToggle.addEventListener('change',syncQuietHours);
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const submit=form.querySelector('[type="submit"]');
    submit.disabled=true;
    submit.innerHTML='<span class="inline-spinner"></span> Salvando...';
    status.textContent='';
    setTimeout(()=>{
      submit.disabled=false;
      submit.textContent='Salvar preferências';
      status.textContent='Preferências salvas com sucesso.';
      notify('Preferências de notificação atualizadas');
    },450);
  });
  reset.addEventListener('click',()=>{
    form.reset();
    form.querySelector('[name="channel-push"]').checked=true;
    form.querySelector('[name="channel-email"]').checked=true;
    ['topic-negotiation','topic-payment','topic-delivery','topic-marketplace'].forEach(name=>form.querySelector(`[name="${name}"]`).checked=true);
    syncQuietHours();
    status.textContent='Preferências padrão restauradas. Salve para confirmar.';
  });
  syncQuietHours();
}
function setupAuthValidation(){
  const contactValid=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)||value.replace(/\D/g,'').length>=8;
  const submitState=(form,label,route)=>{const button=form.querySelector('[type="submit"]');button.disabled=true;button.innerHTML=`<span class="inline-spinner"></span> ${label}`;setTimeout(()=>{location.pathname=route.replace('#','')},650)};
  const showError=(form,message)=>{const error=form.querySelector('.field-error');if(error)error.textContent=message;form.querySelectorAll('.input').forEach(input=>input.classList.toggle('invalid',!input.checkValidity()));};
  const login=document.getElementById('login-form');
  if(login)login.addEventListener('submit',event=>{event.preventDefault();const inputs=login.querySelectorAll('input');if(!contactValid(inputs[0].value.trim()))return showError(login,'Informe um e-mail ou telefone válido.');if(inputs[1].value.length<6)return showError(login,'A senha precisa ter pelo menos 6 caracteres.');showError(login,'');submitState(login,'Entrando...','#/app/home')});
  const register=document.getElementById('register-form');
  if(register)register.addEventListener('submit',event=>{event.preventDefault();const inputs=register.querySelectorAll('input');if(inputs[0].value.trim().length<3)return showError(register,'Informe seu nome completo.');if(!contactValid(inputs[1].value.trim()))return showError(register,'Informe um e-mail ou telefone válido.');if(inputs[2].value.length<6)return showError(register,'A senha precisa ter pelo menos 6 caracteres.');if(inputs[2].value!==inputs[3].value)return showError(register,'As senhas precisam ser iguais.');if(!inputs[4].checked)return showError(register,'Aceite os Termos de Uso e a Política de Privacidade.');showError(register,'');submitState(register,'Criando conta...','#/app/verify')});
  const recovery=document.getElementById('recovery-form');
  if(recovery)recovery.addEventListener('submit',event=>{event.preventDefault();const input=recovery.querySelector('input');if(!contactValid(input.value.trim()))return showError(recovery,'Informe um e-mail ou telefone válido.');showError(recovery,'');submitState(recovery,'Enviando código...','#/app/verify')});
  const verify=document.getElementById('verify-form');
  if(verify){const digits=[...verify.querySelectorAll('.otp input')];digits.forEach((input,index)=>{input.addEventListener('input',()=>{input.value=input.value.replace(/\D/g,'').slice(0,1);if(input.value&&digits[index+1])digits[index+1].focus()});input.addEventListener('keydown',event=>{if(event.key==='Backspace'&&!input.value&&digits[index-1])digits[index-1].focus()})});verify.addEventListener('submit',event=>{event.preventDefault();if(digits.map(input=>input.value).join('').length!==6)return showError(verify,'Digite os seis números do código.');showError(verify,'');submitState(verify,'Verificando...','#/app/home')});document.getElementById('resend-code')?.addEventListener('click',()=>{digits.forEach(input=>input.value='');digits[0].focus();verify.querySelector('.otp-time').textContent='Novo código enviado · expira em 00:45';notify('Novo código enviado com sucesso')})}
  document.getElementById('auth-retry')?.addEventListener('click',event=>{const button=event.currentTarget;button.disabled=true;button.innerHTML='<span class="inline-spinner"></span> Verificando conexão...';setTimeout(()=>{notify('Conexão restabelecida');location.pathname='/app/login'},650)});
}

function setupWalletLogisticsExtras(){document.getElementById('wallet-card-add')?.addEventListener('click',()=>{const panel=document.getElementById('wallet-card-panel');panel.innerHTML='<div class="panel"><div class="form-group"><label>Número do cartão</label><input class="input" inputmode="numeric" placeholder="0000 0000 0000 0000"></div><div class="form-row"><div class="form-group"><label>Validade</label><input class="input" placeholder="MM/AA"></div><div class="form-group"><label>CVV</label><input class="input" inputmode="numeric" placeholder="000"></div></div><button class="button primary block" id="wallet-card-save">Salvar cartão</button></div>';document.getElementById('wallet-card-save')?.addEventListener('click',event=>{event.currentTarget.disabled=true;event.currentTarget.textContent='Cartão tokenizado com segurança';notify('Cartão adicionado com segurança')})});document.querySelectorAll('[data-action="remove-card"]').forEach(button=>button.addEventListener('click',()=>{button.closest('.phone-card')?.remove();notify('Cartão removido')}));document.getElementById('dispute-submit')?.addEventListener('click',event=>{const reason=document.getElementById('dispute-reason');const details=document.getElementById('dispute-details');const error=document.getElementById('dispute-error');if(!reason.value||details.value.trim().length<10){error.textContent='Selecione o motivo e descreva o ocorrido com pelo menos 10 caracteres.';return}const content=document.getElementById('dispute-content');event.currentTarget.disabled=true;event.currentTarget.innerHTML='<span class="inline-spinner"></span> Registrando...';setTimeout(()=>{content.innerHTML='<a class="back-link-inline" href="/app/wallet">← Carteira</a><div class="ui-state success-state"><div class="state-icon success">✓</div><span class="eyebrow">Mediação iniciada</span><h1>Disputa registrada</h1><p>O valor permanece protegido enquanto a equipe analisa as evidências.</p><div class="notice">Protocolo #MED-4827 · Retorno estimado em até 2 dias úteis.</div><a class="button primary block" href="/app/wallet">Voltar à carteira</a></div>';notify('Disputa enviada para mediação')},500)});document.getElementById('reschedule-submit')?.addEventListener('click',event=>{event.currentTarget.disabled=true;event.currentTarget.textContent='Entrega reagendada';document.getElementById('reschedule-content')?.insertAdjacentHTML('beforeend','<div class="notice success-notice">Nova janela confirmada. Entregador e vendedor foram notificados.</div>');notify('Entrega reagendada com sucesso')})}
function setupActionStates(){const payment=document.getElementById('payment-submit');if(payment)payment.addEventListener('click',()=>{payment.disabled=true;payment.innerHTML='<span class="inline-spinner"></span> Processando pagamento...';setTimeout(()=>{location.pathname='/app/payment-success'},700)});const rating=document.getElementById('rating-submit');const ratingContent=document.getElementById('rating-content');if(rating&&ratingContent)rating.addEventListener('click',()=>{rating.disabled=true;rating.innerHTML='<span class="inline-spinner"></span> Enviando...';setTimeout(()=>{ratingContent.innerHTML='<div class="ui-state success-state"><div class="state-icon success">✓</div><span class="eyebrow">Avaliação enviada</span><h1>Obrigado pela avaliação!</h1><p>Sua opinião fortalece a reputação da comunidade e ajuda outras famílias.</p><a class="button primary block" href="/app/home">Voltar ao início</a></div>';notify('Avaliação enviada com sucesso')},550)});const publish=document.getElementById('publish-submit');const publishContent=document.getElementById('publish-content');if(publish&&publishContent)publish.addEventListener('click',()=>{publish.disabled=true;publish.innerHTML='<span class="inline-spinner"></span> Publicando...';setTimeout(()=>{publishContent.innerHTML='<div class="ui-state success-state"><div class="state-icon success">✓</div><span class="eyebrow">Anúncio publicado</span><h1>Seu anúncio está no ar!</h1><p>Pampers Confort já pode ser encontrado por famílias próximas.</p><a class="button primary block" href="/app/home">Ver anúncio na página inicial</a><a class="button secondary block" href="/app/profile">Gerenciar meus anúncios</a></div>';notify('Anúncio publicado com sucesso')},700)});const deliveryProblem=document.getElementById('delivery-problem-submit');const deliveryContent=document.getElementById('delivery-confirm-content');if(deliveryProblem&&deliveryContent)deliveryProblem.addEventListener('click',()=>{deliveryContent.innerHTML='<a class="back-link-inline" href="/app/delivery">← Acompanhar entrega</a><div class="ui-state error-state"><div class="state-icon danger">!</div><span class="eyebrow">Pagamento protegido</span><h1>Conte o que aconteceu</h1><p>O pagamento continuará bloqueado até a análise do atendimento.</p><div class="form-group state-form"><label>Problema com a entrega</label><select class="input"><option>Produto não recebido</option><option>Produto diferente</option><option>Embalagem danificada</option></select></div><a class="button primary block" href="/app/chat">Falar com o suporte</a></div>'});document.querySelectorAll('[data-action="export"]').forEach(button=>button.addEventListener('click',()=>{const label=button.querySelector('strong')?.textContent||'arquivo';button.disabled=true;button.innerHTML=`<span class="inline-spinner dark"></span><strong>Preparando ${label}</strong>`;setTimeout(()=>{button.disabled=false;button.innerHTML=`<span class="feedback-icon success">✓</span><strong>${label} pronto</strong><span>Baixar</span>`;notify(`Relatório ${label} preparado para exportação`)},600)}))}

document.querySelectorAll(".favorite").forEach(button=>button.addEventListener("click",()=>{button.classList.toggle("active");button.textContent=button.classList.contains("active")?"♥":"♡";notify(button.classList.contains("active")?"Adicionado aos favoritos":"Removido dos favoritos")}));
document.querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",()=>{if(button.dataset.action!=="export")notify(actionMessage(button.dataset.action))}));
setupNotifications();
setupNotificationSettings();
setupAuthValidation();
setupWalletLogisticsExtras();
setupActionStates();
