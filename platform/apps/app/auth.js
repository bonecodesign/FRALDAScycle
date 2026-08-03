function notify(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
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

setupAuthValidation();
