import "/apps/admin/auth.js";
import { apiRequest } from "/packages/contracts/api-client.js";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
let otherSessionCount = 0;

function cell(row, value) { const element = document.createElement("td"); element.textContent = value; row.append(element); }
function message(error) {
  if (error?.status === 401) return "Sessão administrativa necessária para consultar os acessos.";
  if (error?.status === 403) return "Esta conta não possui permissão para gerenciar sessões.";
  return error?.message || "Sessões indisponíveis nesta consulta.";
}

async function loadSessions() {
  const body = document.getElementById("security-session-rows"); const status = document.getElementById("security-status"); const revoke = document.getElementById("security-revoke-others");
  status.textContent = "Consultando sessões…"; revoke.disabled = true;
  try {
    const result = await apiRequest("/v1/admin/sessions"); body.replaceChildren(); otherSessionCount = 0;
    for (const session of result.items ?? []) {
      const row = document.createElement("tr"); cell(row, session.id); cell(row, session.user_agent || "Não informado");
      cell(row, dateTime.format(new Date(session.created_at))); cell(row, dateTime.format(new Date(session.expires_at))); cell(row, session.current ? "Sessão atual" : "Outra sessão ativa");
      if (!session.current) otherSessionCount += 1; body.append(row);
    }
    document.getElementById("security-session-empty").hidden = body.rows.length > 0; revoke.disabled = otherSessionCount === 0;
    status.textContent = `${body.rows.length.toLocaleString("pt-BR")} sessão(ões) ativa(s); ${otherSessionCount.toLocaleString("pt-BR")} pode(m) ser encerrada(s).`;
  } catch (error) { body.replaceChildren(); document.getElementById("security-session-empty").hidden = false; status.textContent = message(error); }
}

document.getElementById("security-refresh")?.addEventListener("click", loadSessions);
document.getElementById("security-revoke-others")?.addEventListener("click", async event => {
  const button = event.currentTarget; button.disabled = true;
  try { const result = await apiRequest("/v1/admin/sessions/revoke-others", { method: "POST" }); document.getElementById("security-status").textContent = `${Number(result.revokedCount).toLocaleString("pt-BR")} outra(s) sessão(ões) encerrada(s) e auditada(s).`; await loadSessions(); }
  catch (error) { document.getElementById("security-status").textContent = message(error); button.disabled = otherSessionCount === 0; }
});

await loadSessions();
