import { apiRequest } from "/packages/contracts/api-client.js";
import { notify } from "/packages/ui/notify.js";

const form = document.getElementById("operational-control-form");
const states = document.getElementById("operational-control-states");
const summary = document.getElementById("operational-control-summary");
const feedback = document.getElementById("operational-control-feedback");
const labels = { global: "Toda a plataforma", marketplace: "Marketplace", payments: "Pagamentos", logistics: "Logística", donations: "Doações", premium: "Premium" };

function render(items) {
  if (!states) return;
  if (!Array.isArray(items) || items.some(item => !item || !Object.hasOwn(labels,item.domain) || typeof item.paused !== 'boolean' || (item.paused && typeof item.reason !== 'string'))) throw new Error('Estado operacional inválido.');
  states.replaceChildren();
  for (const item of items) {
    const article=document.createElement('article'),icon=document.createElement('span'),content=document.createElement('div'),title=document.createElement('strong'),reason=document.createElement('p'),badge=document.createElement('span');
    article.className='phone-card';icon.className='status-icon';icon.textContent=item.paused?'!':'✓';
    title.textContent=labels[item.domain];reason.textContent=item.paused?item.reason:'Novas operações autorizadas';
    badge.className='badge'+(item.paused?' warn':'');badge.textContent=item.paused?'Pausado':'Ativo';
    content.append(title,reason);article.append(icon,content,badge);states.append(article);
  }
  const paused = items.filter(item => item.paused).length;
  summary.textContent = paused ? `${paused} domínio${paused === 1 ? "" : "s"} pausado${paused === 1 ? "" : "s"}` : "Operação ativa";
}

async function load() {
  if (!form) return;
  states?.replaceChildren();
  try {
    const result = await apiRequest("/v1/admin/operational-control");
    render(result.items);
    document.documentElement.dataset.operationalControlState = "live";
  } catch (error) {
    summary.textContent = "Indisponível no modo demonstrativo";
    document.documentElement.dataset.operationalControlState = error.status === 401 ? "unauthenticated" : error.status === 403 ? "forbidden" : "fallback";
  }
}

form?.addEventListener("submit", async event => {
  event.preventDefault();
  feedback.textContent = "";
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await apiRequest("/v1/admin/operational-control", { method: "PUT", body: {
      domain: form.elements.domain.value,
      action: form.elements.action.value,
      reason: form.elements.reason.value.trim(),
      confirmed: form.elements.confirmed.checked,
    } });
    form.reset();
    await load();
    feedback.textContent = "Alteração registrada com auditoria.";
    notify("Estado operacional atualizado e auditado");
  } catch (error) {
    feedback.textContent = error.message;
  } finally { submit.disabled = false; }
});

load();
