import "/apps/admin/auth.js";
import "/apps/admin/navigation.js";
import { apiRequest } from "/packages/contracts/api-client.js";

const MAX_CSV_BYTES = 5_000_000;
const PENDING_STATUSES = new Set(["pending_first_review", "pending_second_review"]);
const statusLabels = Object.freeze({
  pending_first_review: "Aguardando primeira revisão",
  pending_second_review: "Aguardando segunda revisão",
  active: "Ativo",
  rejected: "Rejeitado",
  superseded: "Substituído",
});

const importForm = document.getElementById("manufacturer-catalog-import");
const reviewForm = document.getElementById("manufacturer-catalog-review");
const reviewPanel = document.getElementById("manufacturer-catalog-review-panel");
const reviewSummary = document.getElementById("manufacturer-catalog-review-summary");
const rows = document.getElementById("manufacturer-catalog-rows");
const empty = document.getElementById("manufacturer-catalog-empty");
const status = document.getElementById("manufacturer-catalog-status");
let selectedBatch = null;

const displayDate = value => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("pt-BR") : "Não informada";
};

function cell(value) {
  const element = document.createElement("td");
  element.textContent = value;
  return element;
}

function reviewers(batch) {
  const total = Number(Boolean(batch.first_reviewer_id)) + Number(Boolean(batch.second_reviewer_id));
  return `${total}/2 revisões concluídas`;
}

function openReview(batch) {
  selectedBatch = batch;
  reviewSummary.textContent = `${batch.manufacturer} · versão ${batch.version} · ${statusLabels[batch.status] ?? batch.status}`;
  reviewForm.reset();
  reviewPanel.hidden = false;
  reviewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function render(items) {
  rows.replaceChildren();
  empty.hidden = items.length > 0;
  for (const batch of items) {
    const row = document.createElement("tr");
    row.append(cell(batch.manufacturer ?? "Não informado"));
    const source = document.createElement("td");
    const link = document.createElement("a");
    link.href = batch.source_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Abrir fonte oficial";
    const date = document.createElement("small");
    date.textContent = `Vigência: ${displayDate(batch.effective_date)}`;
    source.append(link, document.createElement("br"), date);
    row.append(source, cell(String(batch.entry_count ?? 0)),
      cell(`${statusLabels[batch.status] ?? "Estado desconhecido"} · v${batch.version}`),
      cell(reviewers(batch)));
    const action = document.createElement("td");
    if (PENDING_STATUSES.has(batch.status)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button secondary small";
      button.textContent = "Revisar";
      button.addEventListener("click", () => openReview(batch));
      action.append(button);
    } else action.textContent = "Sem ação pendente";
    row.append(action);
    rows.append(row);
  }
}

async function loadBatches() {
  status.textContent = "Consultando lotes oficiais…";
  try {
    const result = await apiRequest("/v1/admin/manufacturer-catalog/batches", { signal: AbortSignal.timeout(15_000) });
    const items = Array.isArray(result.items) ? result.items : [];
    render(items);
    status.textContent = items.length ? `${items.length} lote(s) encontrado(s).` : "Nenhum lote oficial foi importado.";
  } catch (error) {
    status.textContent = error.message || "Não foi possível consultar os lotes.";
  }
}

importForm?.addEventListener("submit", async event => {
  event.preventDefault();
  const file = importForm.elements.catalogFile.files?.[0];
  if (!file || file.size < 1 || file.size > MAX_CSV_BYTES || !importForm.elements.confirmed.checked) {
    status.textContent = "Selecione um CSV de até 5 MB e confirme a procedência oficial.";
    return;
  }
  const button = importForm.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    const csv = await file.text();
    await apiRequest("/v1/admin/manufacturer-catalog/imports", { method: "POST", body: {
      manufacturer: importForm.elements.manufacturer.value.trim(),
      sourceUrl: importForm.elements.sourceUrl.value.trim(),
      effectiveDate: importForm.elements.effectiveDate.value,
      documentSha256: importForm.elements.documentSha256.value.trim().toLowerCase(),
      csv,
    } });
    importForm.reset();
    status.textContent = "Lote importado. Duas revisões independentes ainda são obrigatórias antes da ativação.";
    await loadBatches();
  } catch (error) {
    status.textContent = error.message || "Não foi possível importar o catálogo.";
  } finally {
    button.disabled = false;
  }
});

reviewForm?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!selectedBatch || !PENDING_STATUSES.has(selectedBatch.status) || !reviewForm.elements.confirmed.checked) {
    status.textContent = "Atualize os lotes e confirme uma revisão pendente.";
    return;
  }
  const button = reviewForm.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    await apiRequest(`/v1/admin/manufacturer-catalog/batches/${encodeURIComponent(selectedBatch.id)}/reviews`, {
      method: "POST",
      body: {
        decision: reviewForm.elements.decision.value,
        reason: reviewForm.elements.reason.value.trim(),
        expectedVersion: selectedBatch.version,
        confirmed: true,
      },
    });
    reviewPanel.hidden = true;
    selectedBatch = null;
    status.textContent = "Revisão registrada com auditoria. O estado do lote foi atualizado pelo servidor.";
    await loadBatches();
  } catch (error) {
    status.textContent = error.message || "Não foi possível registrar a revisão independente.";
  } finally {
    button.disabled = false;
  }
});

document.getElementById("manufacturer-catalog-refresh")?.addEventListener("click", loadBatches);
document.getElementById("manufacturer-catalog-review-close")?.addEventListener("click", () => {
  reviewPanel.hidden = true;
  selectedBatch = null;
});

const sourceForm = document.getElementById("manufacturer-source-create");
const sourceRows = document.getElementById("manufacturer-source-rows");
const sourceEmpty = document.getElementById("manufacturer-source-empty");
const sourceStatus = document.getElementById("manufacturer-source-status");
const candidatePanel = document.getElementById("manufacturer-source-candidates-panel");
const candidateRows = document.getElementById("manufacturer-source-candidate-rows");
const sourceOriginLabels = Object.freeze({ fixed_config: "Configuração fixa", manual: "Manual", discovered: "Descoberta" });
const reviewLabels = Object.freeze({ pending: "Pendente", approved: "Aprovada", rejected: "Rejeitada" });

function sourceActionButton(label, handler, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button secondary small";
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", handler);
  return button;
}

function renderSources(items = [], candidates = []) {
  sourceRows?.replaceChildren();
  if (sourceEmpty) sourceEmpty.hidden = items.length > 0;
  for (const source of items) {
    const row = document.createElement("tr");
    const sourceCell = document.createElement("td");
    const link = document.createElement("a");
    link.href = source.source_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = source.source_url;
    sourceCell.append(link);
    row.append(sourceCell, cell(sourceOriginLabels[source.origin] ?? source.origin ?? "Não informado"), cell(reviewLabels[source.review_status] ?? source.review_status ?? "Pendente"), cell(source.refresh_enabled ? "Sim" : "Não"));
    const actions = document.createElement("td");
    if (source.review_status === "pending") {
      actions.append(sourceActionButton("Aprovar", () => decideSource(source, "approve")), sourceActionButton("Rejeitar", () => decideSource(source, "reject")));
    } else if (source.review_status === "approved") {
      actions.append(sourceActionButton(source.refresh_enabled ? "Desativar" : "Ativar", () => activateSource(source, !source.refresh_enabled)));
    } else actions.textContent = "Sem ação pendente";
    row.append(actions);
    sourceRows?.append(row);
  }
  candidateRows?.replaceChildren();
  if (candidatePanel) candidatePanel.hidden = candidates.length === 0;
  for (const candidate of candidates) {
    const row = document.createElement("tr");
    row.append(cell(candidate.source_url ?? "Não informado"), cell(candidate.discovered_at ? new Date(candidate.discovered_at).toLocaleString("pt-BR") : "Não informada"), cell("Aguardando revisão"));
    candidateRows?.append(row);
  }
}

async function loadSources() {
  if (!sourceStatus) return;
  sourceStatus.textContent = "Consultando fontes de disponibilidade…";
  try {
    const result = await apiRequest("/v1/admin/manufacturer-catalog/sources", { signal: AbortSignal.timeout(15_000) });
    const sources = Array.isArray(result.sources) ? result.sources : [];
    const candidates = Array.isArray(result.candidates) ? result.candidates : [];
    renderSources(sources, candidates);
    sourceStatus.textContent = `${sources.length} fonte(s) cadastrada(s) · ${candidates.length} candidata(s) aguardando revisão.`;
  } catch (error) { sourceStatus.textContent = error.message || "Não foi possível consultar as fontes."; }
}

async function decideSource(source, decision) {
  const reason = window.prompt(decision === "approve" ? "Justificativa da aprovação:" : "Justificativa da rejeição:");
  if (!reason || reason.trim().length < 10 || !window.confirm("Confirmar decisão auditada para esta fonte?")) return;
  try {
    await apiRequest(`/v1/admin/manufacturer-catalog/sources/${encodeURIComponent(source.id)}/decision`, { method: "POST", body: { decision, reason: reason.trim(), confirmed: true } });
    sourceStatus.textContent = "Decisão registrada com auditoria.";
    await loadSources();
  } catch (error) { sourceStatus.textContent = error.message || "Não foi possível registrar a decisão."; }
}

async function activateSource(source, enabled) {
  if (!window.confirm(`${enabled ? "Ativar" : "Desativar"} esta fonte para a atualização horária?`)) return;
  try {
    await apiRequest(`/v1/admin/manufacturer-catalog/sources/${encodeURIComponent(source.id)}/activation`, { method: "POST", body: { enabled } });
    sourceStatus.textContent = `Fonte ${enabled ? "ativada" : "desativada"}.`;
    await loadSources();
  } catch (error) { sourceStatus.textContent = error.message || "Não foi possível alterar a ativação."; }
}

sourceForm?.addEventListener("submit", async event => {
  event.preventDefault();
  const button = sourceForm.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    await apiRequest("/v1/admin/manufacturer-catalog/sources", { method: "POST", body: { sourceUrl: sourceForm.elements.sourceUrl.value.trim(), origin: sourceForm.elements.origin.value } });
    sourceForm.reset();
    sourceStatus.textContent = "Fonte cadastrada e aguardando revisão independente.";
    await loadSources();
  } catch (error) { sourceStatus.textContent = error.message || "Não foi possível cadastrar a fonte."; }
  finally { button.disabled = false; }
});

document.getElementById("manufacturer-source-refresh")?.addEventListener("click", loadSources);

void loadBatches();
void loadSources();
