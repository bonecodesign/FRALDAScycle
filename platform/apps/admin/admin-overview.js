import "/apps/admin/auth.js";
import "/apps/admin/navigation.js";
import { apiRequest } from "/packages/contracts/api-client.js";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const labels = Object.freeze({ sale: "Venda", exchange: "Troca", donation: "Doação", proposed: "Proposta", reserved: "Reservada", payment_pending: "Pagamento pendente", paid: "Paga", in_delivery: "Em entrega", donation_confirmed: "Doação confirmada", completed: "Concluída", cancelled: "Cancelada", disputed: "Em disputa", refunded: "Reembolsada" });
let currentResult = null;

function count(value) { return Number(value ?? 0).toLocaleString("pt-BR"); }
function currency(value) { return money.format(Number(value ?? 0) / 100); }
function set(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function cell(row, value) { const element = document.createElement("td"); element.textContent = value; row.append(element); }
function csvCell(value) { let text = String(value ?? ""); if (/^[=+\-@]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; }
function unavailable(error) {
  if (error?.status === 401) return "Sessão administrativa necessária para consultar estes dados.";
  if (error?.status === 403) return "Esta conta não possui permissão para consultar estes dados.";
  return "Dados operacionais indisponíveis. Nenhum valor demonstrativo foi exibido.";
}

function renderSummary(summary) {
  set("overview-users", count(summary.active_user_count)); set("overview-listings", count(summary.listing_count));
  set("overview-transactions", count(summary.transaction_count)); set("overview-volume", currency(summary.paid_volume_cents));
  set("overview-completed", count(summary.completed_transaction_count)); set("overview-active", count(summary.active_transaction_count));
  set("overview-exceptions", count(summary.exception_transaction_count)); set("overview-shipments", count(summary.shipment_count));
  set("overview-delivered", count(summary.delivered_shipment_count)); set("overview-shipment-exceptions", count(summary.shipment_exception_count));
  set("overview-payment-exceptions", count(summary.payment_exception_count)); set("overview-payment-cases", count(summary.open_payment_case_count));
  set("overview-paused", count(summary.paused_domain_count));
}

function renderTransactions(items) {
  const body = document.getElementById("overview-rows");
  if (!body) return;
  body.replaceChildren();
  for (const item of items) {
    const row = document.createElement("tr");
    cell(row, item.id); cell(row, labels[item.kind] ?? item.kind); cell(row, labels[item.status] ?? item.status);
    cell(row, item.amount_cents == null ? "Não se aplica" : currency(item.amount_cents)); cell(row, dateTime.format(new Date(item.created_at)));
    body.append(row);
  }
  document.getElementById("overview-empty").hidden = body.rows.length > 0;
}

function addAlert(container, title, detail, href) {
  const article = document.createElement("article"); article.className = "phone-card";
  const indicator = document.createElement("span"); indicator.className = "alert-indicator warning";
  const content = document.createElement("div"); const strong = document.createElement("strong"); const paragraph = document.createElement("p");
  strong.textContent = title; paragraph.textContent = detail; content.append(strong, paragraph);
  const link = document.createElement("a"); link.className = "button small secondary"; link.href = href; link.textContent = "Abrir fluxo";
  article.append(indicator, content, link); container.append(article);
}

function renderAlerts(summary) {
  const container = document.getElementById("verified-alert-list");
  if (!container) return;
  container.replaceChildren();
  const definitions = [
    [summary.payment_exception_count, "pagamento(s) com falha, cancelamento ou reembolso", "Estado persistido em pagamentos.", "/admin/finance"],
    [summary.open_payment_case_count, "ocorrência(s) financeira(s) aberta(s)", "Disputas ou solicitações ainda em tratamento.", "/admin/finance"],
    [summary.shipment_exception_count, "entrega(s) com falha ou cancelamento", "Estado persistido em logística.", "/admin/logistics"],
    [summary.paused_domain_count, "domínio(s) operacional(is) pausado(s)", "A pausa requer revisão no controle operacional.", "/admin/operations"],
  ];
  let total = 0;
  for (const [raw, title, detail, href] of definitions) { const value = Number(raw ?? 0); if (value > 0) { total += value; addAlert(container, `${count(value)} ${title}`, detail, href); } }
  document.getElementById("verified-alert-empty").hidden = total > 0;
  set("alert-count", total ? `${count(total)} pendência(s) derivada(s) dos registros.` : "Nenhuma pendência derivada dos registros.");
}

function exportCsv() {
  if (!currentResult) return;
  const summary = currentResult.summary;
  const rows = [
    ["Indicador", "Valor"], ["Usuários ativos", summary.active_user_count], ["Anúncios", summary.listing_count],
    ["Transações", summary.transaction_count], ["Volume confirmado em centavos", summary.paid_volume_cents], ["Entregas", summary.shipment_count], [],
    ["Transação", "Tipo", "Estado", "Valor em centavos", "Criação"],
    ...currentResult.items.map(item => [item.id, item.kind, item.status, item.amount_cents, item.created_at]),
  ];
  const blob = new Blob(["\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "fraldacycle-relatorio-operacional.csv"; link.click(); URL.revokeObjectURL(url);
}

async function loadOverview() {
  const status = document.getElementById("overview-status"); const refresh = document.getElementById("overview-refresh"); const exportButton = document.getElementById("report-export-csv");
  refresh.disabled = true; if (exportButton) exportButton.disabled = true; status.textContent = "Consultando dados…";
  try {
    currentResult = await apiRequest("/v1/admin/overview-snapshot?limit=50");
    renderSummary(currentResult.summary ?? {}); renderTransactions(currentResult.items ?? []); renderAlerts(currentResult.summary ?? {});
    status.textContent = `Consulta concluída: ${count(currentResult.items?.length)} transação(ões) recente(s) exibida(s).`;
    if (exportButton) exportButton.disabled = false;
  } catch (error) { currentResult = null; status.textContent = unavailable(error); }
  finally { refresh.disabled = false; }
}

document.getElementById("overview-refresh")?.addEventListener("click", loadOverview);
document.getElementById("report-export-csv")?.addEventListener("click", exportCsv);
await loadOverview();
