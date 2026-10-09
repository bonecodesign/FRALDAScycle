import { notify } from "/packages/ui/notify.js";

function markUnavailable(button, message) {
  if (!button) return;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    notify(message);
  });
}

export function setupWalletLogisticsExtras() {
  markUnavailable(document.getElementById("wallet-card-add"), "Cartões salvos estarão disponíveis após a homologação do provedor de pagamento.");
  document.querySelectorAll('[data-action="remove-card"]').forEach((button) => markUnavailable(button, "Nenhum cartão real está vinculado a esta conta."));
  markUnavailable(document.getElementById("reschedule-submit"), "O reagendamento ainda não está integrado. Use o suporte para alterar a entrega.");
}

export function setupActionStates() {
  const deliveryProblem = document.getElementById("delivery-problem-submit");
  const deliveryContent = document.getElementById("delivery-confirm-content");
  if (deliveryProblem && deliveryContent) deliveryProblem.addEventListener("click", () => {
    deliveryContent.innerHTML = '<a class="back-link-inline" href="/app/delivery">← Acompanhar entrega</a><div class="ui-state error-state"><div class="state-icon danger">!</div><span class="eyebrow">Pagamento protegido</span><h1>Conte o que aconteceu</h1><p>Nenhuma ocorrência foi registrada ainda. Abra o atendimento para criar um protocolo real.</p><a class="button primary block" href="/app/chat">Falar com o suporte</a></div>';
  });
  document.querySelectorAll('[data-action="export"]').forEach((button) => markUnavailable(button, "A exportação ainda não está conectada aos dados da sua conta."));
}
