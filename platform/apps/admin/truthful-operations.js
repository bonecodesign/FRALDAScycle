import "/apps/admin/auth.js";
import "/apps/admin/navigation.js";
import { apiRequest } from "/packages/contracts/api-client.js";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const labels = Object.freeze({
  pending: "Pendente", authorized: "Autorizado", provider_pending: "Pendente no provedor",
  paid: "Confirmado", disputed: "Em disputa", refunded: "Reembolsado", failed: "Falhou",
  awaiting_pickup: "Aguardando coleta", assigned: "Atribuída", picked_up: "Coletada",
  in_transit: "Em deslocamento", delivered: "Entregue", cancelled: "Cancelada",
  1: "Ida", 2: "Volta", pickup: "Retirada local", partner: "Parceiro logístico",
  postal: "Envio postal", express: "Entrega express", pix: "PIX", credit: "Cartão de crédito",
});

function label(value) { return labels[value] ?? value ?? "Não informado"; }
function integer(value) { return Number(value ?? 0).toLocaleString("pt-BR"); }
function currency(cents) { return money.format(Number(cents ?? 0) / 100); }
function when(value) { return value ? dateTime.format(new Date(value)) : "Não registrada"; }
function cell(row, value) { const element = document.createElement("td"); element.textContent = value; row.append(element); }

function unavailable(error) {
  if (error?.status === 401) return "Sessão administrativa necessária para consultar estes dados.";
  if (error?.status === 403) return "Esta conta não possui permissão para consultar estes dados.";
  return "Dados operacionais indisponíveis nesta consulta. Nenhum valor demonstrativo foi exibido.";
}

async function loadFinance() {
  const status = document.getElementById("finance-status");
  if (!status) return;
  const refresh = document.getElementById("finance-refresh");
  const body = document.getElementById("finance-ledger");
  const empty = document.getElementById("finance-empty");
  refresh.disabled = true;
  status.textContent = "Consultando dados financeiros…";
  try {
    const result = await apiRequest("/v1/admin/finance-snapshot?limit=50");
    const summary = result.summary ?? {};
    document.getElementById("finance-payment-count").textContent = integer(summary.payment_count);
    document.getElementById("finance-paid-volume").textContent = currency(summary.paid_volume_cents);
    document.getElementById("finance-paid-count").textContent = integer(summary.paid_count);
    document.getElementById("finance-pending-count").textContent = integer(summary.pending_count);
    document.getElementById("finance-exception-count").textContent = integer(summary.exception_count);
    body.replaceChildren();
    for (const item of result.items ?? []) {
      const row = document.createElement("tr");
      cell(row, item.id); cell(row, label(item.method)); cell(row, label(item.status));
      cell(row, currency(item.amount_cents)); cell(row, currency(item.platform_fee_cents));
      cell(row, currency(item.seller_amount_cents)); cell(row, integer(item.open_cases));
      cell(row, item.courier_payout_status ? `${label(item.courier_payout_status)} · ${currency(item.courier_amount_cents)}` : "Não registrada");
      body.append(row);
    }
    empty.hidden = body.rows.length > 0;
    status.textContent = `Consulta concluída: ${integer(body.rows.length)} registro(s) exibido(s).`;
  } catch (error) {
    body.replaceChildren(); empty.hidden = false; status.textContent = unavailable(error);
  } finally { refresh.disabled = false; }
}

async function loadLogistics() {
  const status = document.getElementById("logistics-status");
  if (!status) return;
  const refresh = document.getElementById("logistics-refresh");
  const body = document.getElementById("logistics-rows");
  const empty = document.getElementById("logistics-empty");
  refresh.disabled = true;
  status.textContent = "Consultando dados logísticos…";
  try {
    const result = await apiRequest("/v1/admin/logistics-snapshot?limit=50");
    const summary = result.summary ?? {};
    document.getElementById("logistics-total").textContent = integer(summary.shipment_count);
    document.getElementById("logistics-awaiting").textContent = integer(summary.awaiting_pickup_count);
    document.getElementById("logistics-assigned").textContent = integer(summary.assigned_count);
    document.getElementById("logistics-transit").textContent = integer(summary.in_transit_count);
    document.getElementById("logistics-delivered").textContent = integer(summary.delivered_count);
    document.getElementById("logistics-exceptions").textContent = integer(summary.exception_count);
    body.replaceChildren();
    for (const item of result.items ?? []) {
      const row = document.createElement("tr");
      cell(row, item.id); cell(row, item.transaction_id); cell(row, item.exchange_leg ? label(item.exchange_leg) : "Não se aplica");
      cell(row, label(item.mode)); cell(row, item.courier_name ?? "Não atribuído"); cell(row, label(item.status));
      cell(row, item.proof_recorded ? "Registrado" : "Não registrado"); cell(row, when(item.estimated_delivery_at));
      body.append(row);
    }
    empty.hidden = body.rows.length > 0;
    status.textContent = `Consulta concluída: ${integer(body.rows.length)} registro(s) exibido(s).`;
  } catch (error) {
    body.replaceChildren(); empty.hidden = false; status.textContent = unavailable(error);
  } finally { refresh.disabled = false; }
}

document.getElementById("finance-refresh")?.addEventListener("click", loadFinance);
document.getElementById("logistics-refresh")?.addEventListener("click", loadLogistics);
await Promise.all([loadFinance(), loadLogistics()]);
