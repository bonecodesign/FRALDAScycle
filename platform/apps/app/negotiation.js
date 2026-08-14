import { apiRequest } from "/packages/contracts/api-client.js";

function notify(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function normalizeText(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function blockedChatContent(value) {
  const normalized = normalizeText(value);
  const digits = value.replace(/\D/g, "");
  const phonePattern = /(?:\+?55[\s.-]*)?(?:\(?\d{2}\)?[\s.-]*)?(?:9?[\s.-]*\d{4})[\s.-]*\d{4}/;
  const linkPattern = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|com\.br|net|org|io|app|me|link)\b|bit\.ly|linktr\.ee)/i;
  const emailPattern = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
  const socialPattern = /\b(?:instagram|insta|facebook|face\s*book|fb|perfil\s+social)\b|@[a-z0-9._]{3,}/i;
  const qrPattern = /\b(?:qr\s*code|qrcode|codigo\s*qr)\b/i;
  const commercialPattern = /\b(?:desconto|oferta|contraproposta|abaixa(?:r)?|fechar\s+por|pagar\s+por\s+fora|pix\s+direto)\b/i;
  if (phonePattern.test(value) || digits.length >= 8) return "Telefones não podem ser compartilhados no chat.";
  if (emailPattern.test(value) || normalized.includes(" arroba ")) return "E-mails não podem ser compartilhados no chat.";
  if (linkPattern.test(value)) return "Links externos não podem ser compartilhados no chat.";
  if (qrPattern.test(normalized)) return "QR Codes não podem ser compartilhados no chat.";
  if (socialPattern.test(normalized)) return "Perfis de redes sociais não podem ser compartilhados no chat.";
  if (commercialPattern.test(normalized)) return "O preço e as condições não podem ser alterados pelo chat.";
  return "";
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

async function setupProtectedChat() {
  const form = document.getElementById("chat-form");
  if (!form) return;
  const input = document.getElementById("msg");
  const error = document.getElementById("chat-error");
  const gate = document.getElementById("chat-payment-gate");
  const submit = form.querySelector('button[type="submit"]');
  const transactionId = sessionStorage.getItem("fc.activeTransactionId");
  let chatAllowed = false;
  input.disabled = true;
  submit.disabled = true;
  if (gate) gate.textContent = "Verificando a autorização do chat…";
  if (transactionId) {
    try {
      const access = await apiRequest(`/v1/transactions/${encodeURIComponent(transactionId)}/chat-access`);
      chatAllowed = access.allowed === true;
    } catch {
      chatAllowed = false;
    }
  }
  input.disabled = !chatAllowed;
  submit.disabled = !chatAllowed;
  if (gate) {
    gate.textContent = chatAllowed
      ? "Pagamento confirmado. Use o chat somente para combinar preparação, coleta ou retirada."
      : "Chat bloqueado. O servidor libera a conversa somente após confirmar o pagamento e os participantes.";
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!chatAllowed) {
      error.textContent = "Conclua a cobrança dentro do FraldaCycle para liberar o chat.";
      return;
    }
    const message = input.value.trim();
    if (!message) {
      error.textContent = "Digite uma mensagem para enviar.";
      return;
    }
    const blocked = blockedChatContent(message);
    if (blocked) {
      error.textContent = `${blocked} Mantenha a operação dentro do FraldaCycle.`;
      notify("Mensagem bloqueada por segurança");
      return;
    }
    error.textContent = "";
    document.getElementById("message-list").insertAdjacentHTML("beforeend", `<div class="message me">${escapeHtml(message)}</div>`);
    input.value = "";
    notify("Mensagem operacional enviada");
  });
}

function setupSafetyActions() {
  const content = document.getElementById("safety-content");
  if (!content) return;
  const form = document.getElementById("safety-form");
  const reason = document.getElementById("safety-reason");
  const details = document.getElementById("safety-details");
  const error = document.getElementById("safety-error");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!reason.value || details.value.trim().length < 10) {
      error.textContent = "Selecione o motivo e descreva o ocorrido com pelo menos 10 caracteres.";
      return;
    }
    content.innerHTML = '<a class="back-link-inline" href="/app/chat">← Conversa</a><div class="ui-state success-state"><div class="state-icon success">✓</div><span class="eyebrow">Registro protegido</span><h1>Denúncia enviada</h1><p>A equipe de segurança analisará a conversa e as evidências preservadas.</p><a class="button primary block" href="/app/home">Voltar ao início</a></div>';
    notify("Denúncia enviada para análise");
  });
}

void setupProtectedChat();
setupSafetyActions();
