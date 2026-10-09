import { setupWalletLogisticsExtras, setupActionStates } from "/apps/app/action-states.js";
import { notify } from "/packages/ui/notify.js";
import "/packages/ui/iconography.js";
import { apiRequest } from "/packages/contracts/api-client.js";
import { uploadListingMedia } from "/packages/contracts/marketplace-ui.js";

async function setupProfile() {
  const name = document.getElementById("profile-name");
  const role = document.getElementById("profile-role");
  const avatar = document.getElementById("profile-avatar");
  const status = document.getElementById("profile-status");
  if (!name || !role || !avatar || !status) return;
  try {
    const { user } = await apiRequest("/v1/auth/session");
    name.textContent = user.displayName || user.display_name || "Conta FraldaCycle";
    role.textContent = user.role === "courier" ? "Conta de entregador" : user.role === "admin" ? "Conta administrativa" : "Conta de usuário";
    avatar.textContent = name.textContent.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    status.textContent = "Dados da sessão autenticada.";
  } catch (error) {
    status.textContent = error.message || "Não foi possível carregar o perfil.";
    if (error.status === 401) location.pathname = "/app/login";
  }
}

async function setupProfileAds() {
  const list = document.getElementById("profile-ads-list");
  const status = document.getElementById("profile-ads-status");
  const empty = document.getElementById("profile-ads-empty");
  if (!list || !status || !empty) return;
  const labels = { draft: "Rascunho", review: "Em revisão", published: "Publicado", paused: "Pausado", unavailable: "Em operação", completed: "Concluído", removed: "Removido" };
  try {
    const { items } = await apiRequest("/v1/account/listings");
    list.replaceChildren();
    for (const item of items) {
      const card = document.createElement("article"); card.className = "phone-card";
      const content = document.createElement("div");
      const title = document.createElement("strong"); title.textContent = item.title;
      const state = document.createElement("p"); state.textContent = labels[item.status] ?? item.status;
      content.append(title, state);
      if (item.status === "removed" && item.review_reason) {
        const reason = document.createElement("p"); reason.className = "field-error"; reason.textContent = `Motivo: ${item.review_reason}`; content.append(reason);
        if (item.review_outcome === "removed") {
          const edit = document.createElement("button"); edit.type = "button"; edit.className = "button secondary small";
          edit.textContent = "Corrigir e reenviar";
          edit.addEventListener("click", () => openListingCorrection(item, content)); content.append(edit);
        }
      }
      card.append(content); list.append(card);
    }
    empty.hidden = items.length > 0;
    status.textContent = items.length ? `${items.length} anúncio(s) registrado(s).` : "Nenhum anúncio registrado.";
  } catch (error) {
    status.textContent = error.message || "Não foi possível consultar seus anúncios.";
    empty.hidden = true;
    if (error.status === 401) location.pathname = "/app/login";
  }
}

function openListingCorrection(item, container) {
  container.querySelector("form")?.remove();
  const form = document.createElement("form");
  const field = (label, name, value, multiline = false) => {
    const wrapper = document.createElement("label"); wrapper.className = "form-group";
    const caption = document.createElement("span"); caption.textContent = label;
    const input = document.createElement(multiline ? "textarea" : "input"); input.className = "input";
    input.name = name; input.value = value; input.required = true;
    input.minLength = multiline ? 20 : 5; input.maxLength = multiline ? 4_000 : 120;
    wrapper.append(caption, input); form.append(wrapper); return input;
  };
  const title = field("Título corrigido", "title", item.title);
  const description = field("Descrição corrigida", "description", item.description, true);
  const photoLabel = document.createElement("label"); photoLabel.className = "form-group";
  const photoCaption = document.createElement("span"); photoCaption.textContent = "Substituir todas as fotos (opcional, até 8)";
  const photos = document.createElement("input"); photos.type = "file"; photos.multiple = true;
  photos.accept = "image/jpeg,image/png,image/webp"; photoLabel.append(photoCaption, photos); form.append(photoLabel);
  const confirmation = document.createElement("label");
  const checked = document.createElement("input"); checked.type = "checkbox"; checked.required = true;
  confirmation.append(checked, document.createTextNode(" Corrigi o anúncio conforme a justificativa e desejo uma nova revisão."));
  const feedback = document.createElement("p"); feedback.setAttribute("role", "status"); feedback.setAttribute("aria-live", "polite");
  const submit = document.createElement("button"); submit.type = "submit"; submit.className = "button primary block";
  submit.textContent = "Enviar correções para revisão";
  const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "button text";
  cancel.textContent = "Cancelar edição"; cancel.addEventListener("click", () => form.remove());
  form.append(confirmation, feedback, submit, cancel); container.append(form); title.focus();
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const files = Array.from(photos.files ?? []);
    if (files.length > 8) { feedback.textContent = "Selecione no máximo oito fotos."; return; }
    if (files.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 1 || file.size > 10_000_000)) {
      feedback.textContent = "Envie imagens JPEG, PNG ou WebP de até 10 MB cada."; return;
    }
    const body = { title: title.value.trim(), description: description.value.trim(),
      expectedUpdatedAt: item.updated_at, confirmed: checked.checked };
    if (!files.length && body.title === item.title && body.description === item.description) {
      feedback.textContent = "Corrija o título, a descrição ou as fotos antes de reenviar."; return;
    }
    submit.disabled = true; cancel.disabled = true;
    try {
      if (files.length) {
        feedback.textContent = "Enviando novas fotos…";
        body.mediaKeys = [];
        for (const file of files) body.mediaKeys.push(await uploadListingMedia(file));
      }
      feedback.textContent = "Enviando correções…";
      await apiRequest(`/v1/account/listings/${encodeURIComponent(item.id)}/resubmit`, { method: "POST", body });
      await setupProfileAds(); notify("Correções enviadas. O anúncio aguarda nova revisão.");
    } catch (error) {
      feedback.textContent = error.message || "Não foi possível reenviar o anúncio.";
      submit.disabled = false; cancel.disabled = false;
    }
  });
}

function setupLocationPermission() {
  const button = document.querySelector('[data-action="permission"]');
  if (!button) return;
  button.addEventListener("click", () => {
    if (!navigator.geolocation) {
      notify("Localização não é suportada neste dispositivo.");
      return;
    }
    button.disabled = true;
    navigator.geolocation.getCurrentPosition(
      () => { notify("Localização autorizada para esta sessão."); location.pathname = "/app/search"; },
      () => { notify("Permissão não concedida. Altere-a nas configurações do navegador ou dispositivo."); button.disabled = false; },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  });
}
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
    submit.disabled=false;
    submit.textContent='Salvar preferências';
    status.textContent='Preferências de notificação ainda não estão integradas. Nenhuma alteração foi salva.';
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
  document.getElementById('auth-retry')?.addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;button.innerHTML='<span class="inline-spinner"></span> Verificando conexão...';
    try{await apiRequest('/health');notify('Conexão restabelecida');location.pathname='/app/login'}
    catch(error){notify(error.message||'Conexão ainda indisponível');button.disabled=false;button.textContent='Tentar novamente'}
  });
}


void setupProfile();
void setupProfileAds();
setupLocationPermission();
setupNotifications();
setupNotificationSettings();
setupAuthValidation();
setupWalletLogisticsExtras();
setupActionStates();

