import "/apps/admin/auth.js";
import { apiRequest } from "/packages/contracts/api-client.js";

const roleLabels = Object.freeze({ customer: "Cliente", courier: "Entregador", moderator: "Moderação", admin: "Administrador" });
const statusLabels = Object.freeze({ active: "Ativo", suspended: "Suspenso", draft: "Rascunho", review: "Em revisão", published: "Publicado", paused: "Pausado", unavailable: "Indisponível", completed: "Concluído", removed: "Removido" });
const kindLabels = Object.freeze({ sale: "Venda", exchange: "Troca", donation: "Doação" });
const roleScopes = Object.freeze({
  customer: "Uso do marketplace",
  courier: "Marketplace e operação de entrega",
  moderator: "Leitura de usuários, auditoria, instituições e moderação",
  admin: "Todos os escopos administrativos",
});
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
let selectedUser = null;
let selectedListing = null;
let listingReviewSequence = 0;
let loadedReviewContext = null;
let reviewMediaExpiresAt = 0;

function canApproveListing() {
  return Boolean(loadedReviewContext && Date.now() < reviewMediaExpiresAt);
}

function syncListingReviewSubmit() {
  const form = document.getElementById("listing-review-form");
  if (!form) return;
  form.querySelector('[type="submit"]').disabled = !selectedListing ||
    (form.elements.outcome.value === "published" && !canApproveListing());
}

function cell(row, value) { const element = document.createElement("td"); element.textContent = value; row.append(element); }
function count(value) { return Number(value ?? 0).toLocaleString("pt-BR"); }
function unavailable(error) {
  if (error?.status === 401) return "Sessão administrativa necessária para esta consulta.";
  if (error?.status === 403) return "Esta conta não possui permissão para esta operação.";
  return error?.message || "Dados administrativos indisponíveis.";
}

async function loadUsers() {
  const body = document.getElementById("users-rows"); if (!body) return;
  const form = document.getElementById("users-filter"); const status = document.getElementById("users-status");
  const params = new URLSearchParams({ limit: "100" }); const data = new FormData(form);
  for (const name of ["query", "role", "status"]) { const value = String(data.get(name) ?? "").trim(); if (value) params.set(name, value); }
  status.textContent = "Consultando usuários…";
  try {
    const result = await apiRequest(`/v1/admin/users?${params}`); body.replaceChildren();
    for (const user of result.items ?? []) {
      const row = document.createElement("tr"); cell(row, user.display_name); cell(row, user.email); cell(row, roleLabels[user.role] ?? user.role);
      cell(row, user.email_verified_at ? "Sim" : "Não"); cell(row, user.disabled_at ? "Suspenso" : "Ativo");
      const action = document.createElement("td"); const button = document.createElement("button"); button.type = "button"; button.className = "button text"; button.textContent = "Alterar";
      button.addEventListener("click", () => openUserAction(user)); action.append(button); row.append(action); body.append(row);
    }
    document.getElementById("users-empty").hidden = body.rows.length > 0; status.textContent = `${count(body.rows.length)} conta(s) exibida(s).`;
  } catch (error) { body.replaceChildren(); document.getElementById("users-empty").hidden = false; status.textContent = unavailable(error); }
}

function openUserAction(user) {
  selectedUser = user; const panel = document.getElementById("user-action-panel"); const form = document.getElementById("user-action-form");
  panel.hidden = false; form.elements.userId.value = user.id; form.elements.role.value = user.role; form.elements.status.value = user.disabled_at ? "suspended" : "active"; form.elements.reason.value = "";
  document.getElementById("user-action-identity").textContent = `${user.display_name} · ${user.email}`; document.getElementById("user-action-status").textContent = ""; panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.getElementById("users-filter")?.addEventListener("submit", event => { event.preventDefault(); loadUsers(); });
document.getElementById("user-action-close")?.addEventListener("click", () => { document.getElementById("user-action-panel").hidden = true; selectedUser = null; });
document.getElementById("user-action-form")?.addEventListener("submit", async event => {
  event.preventDefault(); if (!selectedUser) return;
  const form = event.currentTarget; const nextRole = form.elements.role.value; const nextStatus = form.elements.status.value; const previousStatus = selectedUser.disabled_at ? "suspended" : "active";
  const roleChanged = nextRole !== selectedUser.role; const statusChanged = nextStatus !== previousStatus; const message = document.getElementById("user-action-status");
  if (!roleChanged && !statusChanged) { message.textContent = "Nenhuma alteração selecionada."; return; }
  if (roleChanged && statusChanged) { message.textContent = "Altere papel e estado em operações separadas para manter a auditoria inequívoca."; return; }
  const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
  try {
    if (roleChanged) await apiRequest(`/v1/admin/users/${encodeURIComponent(selectedUser.id)}/role`, { method: "PATCH", body: { role: nextRole } });
    else {
      const reason = form.elements.reason.value.trim();
      if (reason.length < 10) throw new Error("Registre uma justificativa com pelo menos 10 caracteres.");
      await apiRequest(`/v1/admin/users/${encodeURIComponent(selectedUser.id)}/status`, { method: "PATCH", body: { status: nextStatus, reason } });
    }
    message.textContent = "Alteração persistida e registrada na auditoria."; await loadUsers(); document.getElementById("user-action-panel").hidden = true; selectedUser = null;
  } catch (error) { message.textContent = unavailable(error); } finally { submit.disabled = false; }
});

document.getElementById("user-invite-open")?.addEventListener("click", () => { document.getElementById("user-invite-panel").hidden = false; document.getElementById("user-invite-status").textContent = ""; });
document.getElementById("user-invite-close")?.addEventListener("click", () => { document.getElementById("user-invite-panel").hidden = true; });
document.getElementById("user-invite-form")?.addEventListener("submit", async event => {
  event.preventDefault(); const form = event.currentTarget; const submit = form.querySelector('[type="submit"]'); const status = document.getElementById("user-invite-status"); submit.disabled = true;
  try { await apiRequest("/v1/admin/invitations", { method: "POST", body: Object.fromEntries(new FormData(form)) }); status.textContent = "Convite criado e enfileirado no fluxo transacional."; form.reset(); }
  catch (error) { status.textContent = unavailable(error); } finally { submit.disabled = false; }
});

async function loadCatalog() {
  const body = document.getElementById("catalog-rows"); if (!body) return;
  const form = document.getElementById("catalog-filter"); const params = new URLSearchParams({ limit: "100" });
  if (form) for (const [name, value] of new FormData(form)) if (String(value).trim()) params.set(name, String(value).trim());
  const status = document.getElementById("catalog-status"); status.textContent = "Consultando anúncios…";
  try {
    const result = await apiRequest(`/v1/admin/catalog-snapshot?${params}`); const summary = result.summary ?? {};
    document.getElementById("catalog-total").textContent = count(summary.listing_count); document.getElementById("catalog-published").textContent = count(summary.published_count);
    document.getElementById("catalog-review").textContent = count(summary.review_count); document.getElementById("catalog-paused").textContent = count(summary.paused_count); document.getElementById("catalog-units").textContent = count(summary.unit_count);
    body.replaceChildren();
    for (const item of result.items ?? []) {
      const row = document.createElement("tr"); cell(row, item.id); cell(row, [item.title, item.brand, item.size].filter(Boolean).join(" · ")); cell(row, item.seller_name); cell(row, kindLabels[item.kind] ?? item.kind); cell(row, count(item.quantity)); cell(row, item.price_cents == null ? "Sem preço" : money.format(Number(item.price_cents) / 100)); cell(row, statusLabels[item.status] ?? item.status);
      const action = document.createElement("td");
      if (item.status === "review") {
        const button = document.createElement("button"); button.type = "button"; button.className = "button text"; button.textContent = "Revisar";
        button.addEventListener("click", () => openListingReview(item.id)); action.append(button);
      } else action.textContent = "—";
      row.append(action); body.append(row);
    }
    document.getElementById("catalog-empty").hidden = body.rows.length > 0; status.textContent = `${count(body.rows.length)} anúncio(s) exibido(s).`;
  } catch (error) { body.replaceChildren(); document.getElementById("catalog-empty").hidden = false; status.textContent = unavailable(error); }
}
document.getElementById("catalog-filter")?.addEventListener("submit", event => { event.preventDefault(); loadCatalog(); });
document.getElementById("catalog-refresh")?.addEventListener("click", loadCatalog);

async function openListingReview(listingId) {
  const sequence = ++listingReviewSequence;
  selectedListing = null; loadedReviewContext = null; reviewMediaExpiresAt = 0;
  const form = document.getElementById("listing-review-form"); form.reset(); syncListingReviewSubmit();
  const panel = document.getElementById("listing-review-panel");
  const status = document.getElementById("listing-review-status");
  panel.hidden = false; status.textContent = "Carregando anúncio e mídias protegidas…";
  document.getElementById("listing-review-media").replaceChildren();
  try {
    const result = await apiRequest(`/v1/admin/listings/${encodeURIComponent(listingId)}/review`);
    if (sequence !== listingReviewSequence) return;
    selectedListing = result.listing;
    document.getElementById("listing-review-title").textContent = result.listing.title;
    document.getElementById("listing-review-description").textContent = result.listing.description;
    document.getElementById("listing-review-identity").textContent = `${result.listing.seller_name} · ${kindLabels[result.listing.kind] ?? result.listing.kind} · ${count(result.listing.quantity)} unidades`;
    const media = document.getElementById("listing-review-media");
    const images = result.media ?? [];
    reviewMediaExpiresAt = Math.min(...images.map(item => Date.parse(item.expiresAt)));
    syncListingReviewSubmit();
    await Promise.all(images.map((item, index) => new Promise((resolve, reject) => {
      const image = document.createElement("img");
      const timer = setTimeout(() => { image.onload = null; image.onerror = null; image.removeAttribute("src"); reject(new Error("A foto demorou para carregar. Abra a revisão novamente.")); }, 15_000);
      image.onload = () => { clearTimeout(timer); if (image.naturalWidth > 0) resolve(); else reject(new Error("Foto inválida.")); };
      image.onerror = () => { clearTimeout(timer); reject(new Error("Não foi possível carregar todas as fotos. Abra a revisão novamente.")); };
      image.alt = `Foto ${index + 1} do anúncio em revisão`; image.referrerPolicy = "no-referrer";
      media.append(image); image.src = item.readUrl;
    })));
    if (sequence !== listingReviewSequence) return;
    if (images.length && result.reviewContext && Number.isFinite(reviewMediaExpiresAt) && Date.now() < reviewMediaExpiresAt) {
      loadedReviewContext = result.reviewContext;
      status.textContent = `${images.length} foto(s) carregada(s). Confira o conteúdo antes de decidir.`;
      setTimeout(() => {
        if (sequence !== listingReviewSequence) return;
        loadedReviewContext = null; syncListingReviewSubmit();
        status.textContent = "O acesso às fotos expirou. Abra a revisão novamente antes de aprovar.";
      }, Math.max(0, reviewMediaExpiresAt - Date.now()));
    } else status.textContent = "Fotos ou autorização indisponíveis; a aprovação permanece bloqueada.";
    syncListingReviewSubmit();
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    if (sequence !== listingReviewSequence) return;
    loadedReviewContext = null; syncListingReviewSubmit(); status.textContent = unavailable(error);
  }
}

document.getElementById("listing-review-close")?.addEventListener("click", () => {
  listingReviewSequence++; loadedReviewContext = null;
  selectedListing = null; document.getElementById("listing-review-panel").hidden = true;
  document.getElementById("listing-review-media").replaceChildren();
});
document.getElementById("listing-review-form")?.elements.outcome.addEventListener("change", syncListingReviewSubmit);
document.getElementById("listing-review-form")?.addEventListener("submit", async event => {
  event.preventDefault(); if (!selectedListing) return;
  const form = event.currentTarget; const status = document.getElementById("listing-review-status");
  if (form.elements.outcome.value === "published" && !canApproveListing()) {
    syncListingReviewSubmit(); status.textContent = "Carregue todas as fotos novamente antes de aprovar."; return;
  }
  const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
  try {
    await apiRequest(`/v1/admin/listings/${encodeURIComponent(selectedListing.id)}/review`, {
      method: "POST",
      body: {
        outcome: form.elements.outcome.value,
        reason: form.elements.reason.value.trim(),
        confirmed: form.elements.confirmed.checked,
        reviewContext: loadedReviewContext,
      },
    });
    status.textContent = "Decisão persistida e registrada na auditoria.";
    selectedListing = null; loadedReviewContext = null; listingReviewSequence++;
    form.reset(); document.getElementById("listing-review-media").replaceChildren();
    await loadCatalog();
  } catch (error) { status.textContent = unavailable(error); }
  finally { syncListingReviewSubmit(); }
});

async function loadAccess() {
  const body = document.getElementById("access-rows"); if (!body) return; const status = document.getElementById("access-status");
  try {
    const result = await apiRequest("/v1/admin/access-snapshot"); const counts = new Map((result.items ?? []).map(item => [item.role, item])); body.replaceChildren();
    for (const role of ["customer", "courier", "moderator", "admin"]) { const item = counts.get(role) ?? {}; const row = document.createElement("tr"); cell(row, roleLabels[role]); cell(row, count(item.user_count)); cell(row, count(item.active_count)); cell(row, count(item.email_verified_count)); cell(row, roleScopes[role]); body.append(row); }
    document.getElementById("access-empty").hidden = [...counts.values()].some(item => Number(item.user_count) > 0); status.textContent = "Distribuição consultada no banco; permissões lidas da política efetiva da API.";
  } catch (error) { body.replaceChildren(); document.getElementById("access-empty").hidden = false; status.textContent = unavailable(error); }
}

await Promise.all([loadUsers(), loadCatalog(), loadAccess()]);
