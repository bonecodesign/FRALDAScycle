import "/apps/admin/auth.js";
import { apiRequest } from "/packages/contracts/api-client.js";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const categoryLabels = Object.freeze({ general: "Geral", cancellation: "Cancelamento", receipt_problem: "Problema no recebimento", privacy: "Privacidade", account: "Conta" });
const statusLabels = Object.freeze({ open: "Aberto", under_review: "Em análise", resolved: "Resolvido" });

function cell(row, value) { const element = document.createElement("td"); element.textContent = value; row.append(element); }
function failure(error) {
  if (error?.status === 401) return "Sessão administrativa necessária para consultar o suporte.";
  if (error?.status === 403) return "Esta conta não possui permissão para atender solicitações.";
  return error?.message || "Atendimentos indisponíveis nesta consulta.";
}

async function openTicket(id) {
  const panel = document.getElementById("support-detail"); const replyStatus = document.getElementById("support-reply-status"); replyStatus.textContent = "Consultando atendimento…";
  try {
    const result = await apiRequest(`/v1/support/tickets/${encodeURIComponent(id)}`); const ticket = result.ticket;
    panel.hidden = false; document.getElementById("support-detail-title").textContent = `Protocolo ${ticket.protocol}`;
    document.getElementById("support-detail-description").textContent = `${categoryLabels[ticket.category] ?? ticket.category} · ${ticket.subject} · ${statusLabels[ticket.status] ?? ticket.status}. ${ticket.details}`;
    const messages = document.getElementById("support-messages"); messages.replaceChildren();
    for (const item of ticket.messages ?? []) { const article = document.createElement("article"); article.className = "phone-card"; const content = document.createElement("div"); const body = document.createElement("p"); const when = document.createElement("small"); body.textContent = item.body; when.textContent = dateTime.format(new Date(item.created_at)); content.append(body, when); article.append(content); messages.append(article); }
    const form = document.getElementById("support-reply-form"); form.elements.ticketId.value = ticket.id; form.elements.status.value = ticket.status; form.elements.body.value = ""; replyStatus.textContent = `${messages.children.length} mensagem(ns) registrada(s).`; panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) { panel.hidden = false; replyStatus.textContent = failure(error); }
}

async function loadTickets() {
  const body = document.getElementById("support-rows"); const status = document.getElementById("support-status"); status.textContent = "Consultando atendimentos…";
  try {
    const result = await apiRequest("/v1/support/tickets"); body.replaceChildren();
    for (const ticket of result.items ?? []) { const row = document.createElement("tr"); cell(row, ticket.protocol); cell(row, categoryLabels[ticket.category] ?? ticket.category); cell(row, ticket.subject); cell(row, statusLabels[ticket.status] ?? ticket.status); cell(row, dateTime.format(new Date(ticket.created_at))); const action = document.createElement("td"); const button = document.createElement("button"); button.type = "button"; button.className = "button text"; button.textContent = "Abrir"; button.addEventListener("click", () => openTicket(ticket.id)); action.append(button); row.append(action); body.append(row); }
    document.getElementById("support-empty").hidden = body.rows.length > 0; status.textContent = `${body.rows.length.toLocaleString("pt-BR")} atendimento(s) exibido(s).`;
  } catch (error) { body.replaceChildren(); document.getElementById("support-empty").hidden = false; status.textContent = failure(error); }
}

document.getElementById("support-refresh")?.addEventListener("click", loadTickets);
document.getElementById("support-reply-form")?.addEventListener("submit", async event => {
  event.preventDefault(); const form = event.currentTarget; const submit = form.querySelector('[type="submit"]'); const status = document.getElementById("support-reply-status"); submit.disabled = true;
  try {
    const id = form.elements.ticketId.value; await apiRequest(`/v1/support/tickets/${encodeURIComponent(id)}/reply`, { method: "POST", body: { body: form.elements.body.value.trim(), status: form.elements.status.value } });
    status.textContent = "Resposta persistida e estado atualizado."; await Promise.all([loadTickets(), openTicket(id)]);
  } catch (error) { status.textContent = failure(error); } finally { submit.disabled = false; }
});

await loadTickets();
