import "/apps/admin/auth.js";
import { apiOrigin, apiRequest } from "/packages/contracts/api-client.js";

const pageSize = 25;
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" });
let offset = 0;

function cell(row, value) { const element = document.createElement("td"); element.textContent = value; row.append(element); }
function count(value) { return Number(value ?? 0).toLocaleString("pt-BR"); }
function failure(error) {
  if (error?.status === 401) return "Sessão administrativa necessária para consultar estes registros.";
  if (error?.status === 403) return "Esta conta não possui permissão de auditoria.";
  return error?.message || "Registros indisponíveis nesta consulta.";
}

async function loadAudit() {
  const body = document.getElementById("audit-rows"); if (!body) return;
  const status = document.getElementById("audit-status"); status.textContent = "Consultando auditoria…";
  try {
    const result = await apiRequest(`/v1/admin/audit-events?limit=${pageSize}&offset=${offset}`); body.replaceChildren();
    for (const item of result.items ?? []) { const row = document.createElement("tr"); cell(row, dateTime.format(new Date(item.occurred_at))); cell(row, item.actor_name ?? "Sistema"); cell(row, item.action); cell(row, item.entity_type); cell(row, item.entity_id); body.append(row); }
    if (!body.rows.length && offset > 0) { offset = Math.max(0, offset - pageSize); return loadAudit(); }
    document.getElementById("audit-empty").hidden = body.rows.length > 0; document.getElementById("audit-previous").disabled = offset === 0; document.getElementById("audit-next").disabled = body.rows.length < pageSize;
    document.getElementById("audit-page").textContent = `Página ${Math.floor(offset / pageSize) + 1}`; status.textContent = `${count(body.rows.length)} evento(s) exibido(s).`;
  } catch (error) { body.replaceChildren(); document.getElementById("audit-empty").hidden = false; status.textContent = failure(error); }
}

async function loadWebhooks() {
  const body = document.getElementById("webhook-rows"); if (!body) return;
  const status = document.getElementById("webhook-status"); status.textContent = "Consultando webhooks…";
  try {
    const result = await apiRequest("/v1/admin/webhook-events?limit=100"); body.replaceChildren();
    document.getElementById("webhook-payment-count").textContent = count(result.summary?.payment_event_count); document.getElementById("webhook-logistics-count").textContent = count(result.summary?.logistics_event_count);
    for (const item of result.items ?? []) { const row = document.createElement("tr"); cell(row, item.domain === "payment" ? "Pagamento" : "Logística"); cell(row, item.event_type); cell(row, item.id); cell(row, dateTime.format(new Date(item.occurred_at))); cell(row, dateTime.format(new Date(item.processed_at))); body.append(row); }
    document.getElementById("webhook-empty").hidden = body.rows.length > 0; status.textContent = `${count(body.rows.length)} evento(s) recebido(s) exibido(s).`;
  } catch (error) { body.replaceChildren(); document.getElementById("webhook-empty").hidden = false; status.textContent = failure(error); }
}

document.getElementById("audit-refresh")?.addEventListener("click", loadAudit);
document.getElementById("audit-previous")?.addEventListener("click", () => { offset = Math.max(0, offset - pageSize); loadAudit(); });
document.getElementById("audit-next")?.addEventListener("click", () => { offset += pageSize; loadAudit(); });
document.getElementById("webhook-refresh")?.addEventListener("click", loadWebhooks);
document.getElementById("audit-export")?.addEventListener("click", async event => {
  const button = event.currentTarget; button.disabled = true;
  try {
    const response = await fetch(`${apiOrigin()}/v1/admin/audit-events.csv`, { credentials: "include" });
    if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error?.message || "Não foi possível exportar a auditoria."); }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "fraldacycle-auditoria.csv"; link.click(); URL.revokeObjectURL(url);
    document.getElementById("audit-status").textContent = "CSV gerado a partir da trilha persistida.";
  } catch (error) { document.getElementById("audit-status").textContent = failure(error); }
  finally { button.disabled = false; }
});

await Promise.all([loadAudit(), loadWebhooks()]);
