import "/apps/admin/auth.js";
import "/apps/admin/navigation.js";
import { apiRequest } from "/packages/contracts/api-client.js";

const search = document.getElementById("courier-clearance-search");
const status = document.getElementById("courier-clearance-status");
const details = document.getElementById("courier-clearance-details");
const summary = document.getElementById("courier-clearance-summary");
const decision = document.getElementById("courier-clearance-decision");
const release = document.getElementById("courier-suspension-release");
const closeExpired = document.getElementById("courier-close-expired");
const reviewQueue = document.getElementById("courier-review-queue");
const supportQueue = document.getElementById("courier-support-queue");
const reviewQueueStatus = document.getElementById("courier-review-queue-status");
const supportQueueStatus = document.getElementById("courier-support-queue-status");
let selected = null;

const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const label = value => ({
  onboarding: "Em cadastro", active: "Ativo", suspended: "Suspenso", closed: "Encerrado",
  pending: "Pendente", pending_review: "Aguardando revisão", verified: "Verificado",
  approved: "Aprovado", rejected: "Rejeitado", expired: "Vencido",
  released: "Liberado", closed_sla_expired: "Encerrado por SLA",
}[value] ?? "Não informado");

function item(title, value) {
  const article = document.createElement("article"); article.className = "phone-card";
  const body = document.createElement("div");
  const heading = document.createElement("strong"); heading.textContent = title;
  const text = document.createElement("p"); text.textContent = value;
  body.append(heading, text); article.append(body); summary.append(article);
}

function render(result) {
  const value = result?.eligibility;
  if (!value?.profile) throw new Error("Resposta de elegibilidade inválida.");
  selected = value; summary.replaceChildren();
  item("Conta", label(value.profile.account_status));
  item("Identidade", label(value.profile.identity_status));
  item("Veículo", value.vehicle ? `${value.vehicle.vehicle_type} · ${label(value.vehicle.status)}` : "Não cadastrado");
  item("Atestado", value.clearance ? `${label(value.clearance.status)} · validade ${value.clearance.expires_at ? new Date(value.clearance.expires_at).toLocaleDateString("pt-BR") : "não confirmada"}` : "Não enviado");
  item("Revisão", value.review ? `${value.review.review_kind} · ${label(value.review.status)}` : "Nenhuma revisão");
  item("Suspensão", value.suspension ? label(value.suspension.status) : "Sem suspensão registrada");
  decision.hidden = !(value.review?.status === "pending" && uuid(value.review.id));
  release.hidden = !(value.suspension?.status === "suspended" && uuid(value.suspension.id));
  details.hidden = false;
  status.textContent = "Cadastro consultado. Revise os metadados antes de qualquer decisão.";
}

async function load(courierId) {
  selected = null; details.hidden = true; summary.replaceChildren();
  decision.hidden = true; release.hidden = true; status.textContent = "Consultando cadastro...";
  const result = await apiRequest(`/v1/admin/couriers/${encodeURIComponent(courierId)}/eligibility`, {
    signal: AbortSignal.timeout(15000),
  });
  render(result);
}

function queueButton(courierId, text) {
  const button = document.createElement("button"); button.type = "button";
  button.className = "button secondary block"; button.textContent = text;
  button.addEventListener("click", () => {
    search.elements.courierId.value = courierId;
    search.requestSubmit();
  });
  return button;
}

async function loadQueues() {
  const results = await Promise.allSettled([
    apiRequest("/v1/admin/courier-clearance/review-queue?limit=50"),
    apiRequest("/v1/admin/courier-clearance/support-queue?limit=50"),
  ]);
  reviewQueue.replaceChildren(); supportQueue.replaceChildren();
  if (results[0].status === "fulfilled") {
    const items = Array.isArray(results[0].value.items) ? results[0].value.items : [];
    for (const row of items) reviewQueue.append(queueButton(row.courier_id,
      `${row.review_kind} · vence ${new Date(row.due_at).toLocaleString("pt-BR")}`));
    reviewQueueStatus.textContent = items.length ? `${items.length} revisão(ões) pendente(s).` : "Nenhuma revisão pendente.";
  } else reviewQueueStatus.textContent = results[0].reason.message || "Fila de revisão indisponível.";
  if (results[1].status === "fulfilled") {
    const items = Array.isArray(results[1].value.items) ? results[1].value.items : [];
    const states = { awaiting_request: "Aguardando contato", support_review: "No suporte", priority_review: "Análise prioritária", sla_expired: "SLA vencido" };
    for (const row of items) supportQueue.append(queueButton(row.courier_id, states[row.queue_state] ?? "Suspenso"));
    supportQueueStatus.textContent = items.length ? `${items.length} suspensão(ões) ativa(s).` : "Nenhuma suspensão ativa.";
  } else supportQueueStatus.textContent = results[1].reason.message || "Fila de suporte indisponível.";
}

search.addEventListener("submit", async event => {
  event.preventDefault();
  const courierId = search.elements.courierId.value.trim();
  if (!uuid(courierId)) { status.textContent = "Informe um identificador de entregador válido."; return; }
  const button = search.querySelector("button"); button.disabled = true;
  try { await load(courierId); }
  catch (error) { status.textContent = error.message || "Não foi possível consultar o cadastro."; }
  finally { button.disabled = false; }
});

decision.elements.decision.addEventListener("change", () => {
  const approval = decision.elements.decision.value === "approved";
  for (const field of [decision.elements.issuerVerificationReference, decision.elements.issuedAt, decision.elements.expiresAt]) {
    field.disabled = !approval; field.required = approval;
  }
});

decision.addEventListener("submit", async event => {
  event.preventDefault();
  if (!selected || !uuid(selected.review?.id) || !decision.elements.confirmed.checked) {
    status.textContent = "Consulte novamente e confirme a decisão."; return;
  }
  const approved = decision.elements.decision.value === "approved";
  const issuedAt = approved ? new Date(decision.elements.issuedAt.value) : null;
  const expiresAt = approved ? new Date(decision.elements.expiresAt.value) : null;
  if (approved && (!Number.isFinite(issuedAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || expiresAt <= issuedAt)) {
    status.textContent = "Informe emissão e validade oficiais coerentes."; return;
  }
  const body = {
    decision: decision.elements.decision.value,
    auditReference: decision.elements.auditReference.value.trim(),
    ...(approved ? {
      issuerVerificationReference: decision.elements.issuerVerificationReference.value.trim(),
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    } : {}),
  };
  const button = decision.querySelector("button"); button.disabled = true;
  try {
    await apiRequest(`/v1/admin/courier-clearance/reviews/${selected.review.id}/decision`, { method: "POST", body });
    status.textContent = approved ? "Documento aprovado e decisão auditada." : "Documento rejeitado; conta suspensa e decisão auditada.";
    await load(search.elements.courierId.value.trim());
    await loadQueues();
  } catch (error) { status.textContent = error.message || "Não foi possível registrar a decisão."; }
  finally { button.disabled = false; }
});

release.addEventListener("submit", async event => {
  event.preventDefault();
  if (!selected || !uuid(selected.suspension?.id) || !release.elements.confirmed.checked) {
    status.textContent = "Consulte novamente e confirme a liberação."; return;
  }
  const button = release.querySelector("button"); button.disabled = true;
  try {
    await apiRequest(`/v1/admin/courier-clearance/suspensions/${selected.suspension.id}/release`, {
      method: "POST", body: { confirmed: true, auditReference: release.elements.auditReference.value.trim() },
    });
    status.textContent = "Suspensão revisada. O estado final depende das demais pendências do cadastro.";
    await load(search.elements.courierId.value.trim());
    await loadQueues();
  } catch (error) { status.textContent = error.message || "Não foi possível liberar a suspensão."; }
  finally { button.disabled = false; }
});

closeExpired.addEventListener("click", async () => {
  closeExpired.disabled = true;
  try {
    const result = await apiRequest("/v1/admin/courier-clearance/support/close-expired", { method: "POST" });
    status.textContent = `${result.closed ?? 0} solicitação(ões) encerrada(s) por SLA vencido.`;
    await loadQueues();
  } catch (error) { status.textContent = error.message || "Não foi possível encerrar os casos vencidos."; }
  finally { closeExpired.disabled = false; }
});

decision.elements.decision.dispatchEvent(new Event("change"));
void loadQueues();
