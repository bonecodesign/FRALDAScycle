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

void loadBatches();
