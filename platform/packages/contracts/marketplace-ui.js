import { apiRequest, ApiError } from "./api-client.js";

export function money(cents, kind) {
  if (kind === "donation") return "Doação";
  if (kind === "exchange") return "Troca";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents ?? 0) / 100);
}

function approvedAsset(item) {
  const brand = String(item.brand ?? item.title ?? "").toLocaleLowerCase("pt-BR");
  if (brand.includes("huggies")) return "huggies-approved.png";
  if (brand.includes("babysec")) return "babysec-approved.png";
  if (brand.includes("mamypoko")) return "mamypoko-approved.png";
  return "pampers-approved.png";
}

function listingCard(item, surface) {
  const href = surface === "site" ? `/site/detail?id=${item.id}` : `/app/chat?listing=${item.id}`;
  if (surface === "site") {
    return `<article class="product-card" data-live-listing="${item.id}"><div class="product-image approved-product-stage"><img class="approved-product" src="/source/assets/approved/${approvedAsset(item)}" alt=""></div><div class="product-body"><span class="badge">${item.kind === "sale" ? "Venda" : item.kind === "exchange" ? "Troca" : "Doação"}</span><h3>${item.title}</h3><p>${item.size ?? "Tamanho não informado"} · ${item.quantity} unidades</p><div class="price">${money(item.price_cents, item.kind)}</div><a class="button secondary block small" href="${href}">Ver detalhes</a></div></article>`;
  }
  return `<a class="phone-card" data-live-listing="${item.id}" href="${href}"><img class="phone-thumb" src="/source/assets/approved/${approvedAsset(item)}" alt=""><div><span class="result-deal">${item.kind === "sale" ? "Venda" : item.kind === "exchange" ? "Troca" : "Doação"}</span><h3>${item.title}</h3><p>${item.size ?? "Tamanho não informado"} · ${item.quantity} unidades</p><strong>${money(item.price_cents, item.kind)}</strong></div><button class="favorite" type="button" data-live-favorite="${item.id}" aria-label="Favoritar">♡</button></a>`;
}

export async function loadLiveSearch({ surface, query = "", kind = "", size = "" }) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (kind) params.set("kind", { Venda: "sale", Troca: "exchange", Doação: "donation" }[kind] ?? kind);
  if (size) params.set("size", size);
  const { items } = await apiRequest(`/v1/listings?${params}`);
  return { items, markup: items.map((item) => listingCard(item, surface)).join("") };
}

export async function renderSiteSearch() {
  const grid = document.querySelector(".product-grid");
  const input = document.querySelector("#q");
  if (!grid || !input) return;
  let timer;
  async function refresh() {
    try {
      const { items, markup } = await loadLiveSearch({ surface: "site", query: input.value.trim() });
      if (items.length) grid.innerHTML = markup;
      document.documentElement.dataset.marketplaceState = items.length ? "live" : "empty";
    } catch (error) {
      document.documentElement.dataset.marketplaceState = error instanceof ApiError && error.code === "network_error" ? "fallback" : "error";
    }
  }
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(refresh, 250); });
  await refresh();
}

export async function renderAppSearch() {
  const results = document.querySelector("#app-search-results");
  const button = document.querySelector("#app-search-submit");
  const input = document.querySelector("#app-search-input");
  if (!results || !button || !input) return;
  button.addEventListener("click", async (event) => {
    event.stopImmediatePropagation();
    button.disabled = true;
    results.innerHTML = '<div class="ui-state loading-state" role="status"><div class="skeleton-stack"><i></i><i></i><i></i></div><p>Buscando itens próximos...</p></div>';
    try {
      const { items, markup } = await loadLiveSearch({
        surface: "app", query: input.value.trim(),
        kind: document.querySelector("#app-filter-type")?.value,
        size: document.querySelector("#app-filter-size")?.value,
      });
      results.innerHTML = items.length ? `<div class="section-head compact"><h2>${items.length} resultados</h2><span class="muted">Dados reais</span></div><div class="phone-list">${markup}</div>` : '<div class="ui-state empty-state"><div class="state-icon">⌕</div><h2>Nenhum item encontrado</h2><p>Tente outro termo ou tamanho.</p></div>';
      bindFavoriteButtons(results);
    } catch (error) {
      results.innerHTML = `<div class="ui-state error-state"><h2>Não foi possível buscar</h2><p>${error.message}</p></div>`;
    } finally { button.disabled = false; button.textContent = "Buscar novamente"; }
  }, true);
}

export async function setFavorite(id, saved) {
  return apiRequest(`/v1/favorites/${id}`, { method: saved ? "POST" : "DELETE" });
}

export function bindFavoriteButtons(root = document) {
  root.querySelectorAll("[data-live-favorite]").forEach((button) => button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const saved = !button.classList.contains("active");
    try {
      await setFavorite(button.dataset.liveFavorite, saved);
      button.classList.toggle("active", saved);
      button.textContent = saved ? "♥" : "♡";
    } catch (error) {
      if (error.status === 401) location.pathname = "/app/login";
    }
  }));
}

export async function renderFavorites({ surface }) {
  const target = surface === "site" ? document.querySelector("#site-favorites-content") : document.querySelector(".phone-list");
  if (!target) return;
  try {
    const { items } = await apiRequest("/v1/favorites");
    target.innerHTML = items.length
      ? `<div class="${surface === "site" ? "product-grid" : "phone-list"}">${items.map((item) => listingCard(item, surface)).join("")}</div>`
      : '<div class="ui-state empty-state"><div class="state-icon">♡</div><h2>Nenhum favorito salvo</h2><p>Os anúncios favoritados aparecerão aqui.</p></div>';
    target.querySelectorAll("[data-live-listing]").forEach((card) => {
      const id = card.dataset.liveListing;
      const button = card.querySelector(".favorite");
      if (button) { button.dataset.liveFavorite = id; button.classList.add("active"); button.textContent = "♥"; }
    });
    bindFavoriteButtons(target);
  } catch (error) {
    if (error.status === 401) location.pathname = surface === "site" ? "/site/login" : "/app/login";
  }
}

export async function publishListing(input) {
  return apiRequest("/v1/listings", { method: "POST", body: input });
}

export async function uploadListingMedia(file) {
  const { upload } = await apiRequest("/v1/media/uploads", {
    method: "POST",
    body: { contentType: file.type, sizeBytes: file.size },
  });
  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: { "content-type": file.type, ...upload.headers },
    body: file,
  });
  if (!response.ok) throw new ApiError("upload_failed", response.status, "Não foi possível enviar a foto.");
  return upload.storageKey;
}

export async function geocodeLocation(address) {
  try {
    const { location } = await apiRequest("/v1/geocoding/resolve", {
      method: "POST", body: { address },
    });
    return location;
  } catch (error) {
    if (error instanceof ApiError && error.code === "provider_not_configured") return null;
    throw error;
  }
}
