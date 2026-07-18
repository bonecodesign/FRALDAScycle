const API_URL = window.FRALDACYCLE_API_URL ?? "/demo-api";
const DEMO_MODE = !window.FRALDACYCLE_API_URL;
const DEMO_LISTINGS_KEY = "fraldacycle.demo.listings";
const AUTH_TOKEN_KEY = "fraldacycle.token";
const AUTH_USER_KEY = "fraldacycle.user";

const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const sessionInfo = document.querySelector("#session-info");
const logoutButton = document.querySelector("#logout");
const form = document.querySelector("#listing-form");
const myListingsPanel = document.querySelector("#my-listings-panel");
const myListingResults = document.querySelector("#my-listing-results");
const searchForm = document.querySelector("#search-form");
const quickFilters = document.querySelectorAll(".quick-filter");
const priceField = document.querySelector("#price-field");
const publishGuidance = document.querySelector("#publish-guidance");
const message = document.querySelector("#form-message");
const results = document.querySelector("#listing-results");
const passwordInput = authForm.elements.password;
const passwordToggle = document.querySelector("#toggle-password");

let token = sessionStorage.getItem(AUTH_TOKEN_KEY);
let user;

try {
  user = JSON.parse(sessionStorage.getItem(AUTH_USER_KEY));
} catch {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
  token = null;
}

const labels = { buy: "Compra", sell: "Venda", donate: "Doação" };

const demoListings = [
  ["demo-1", "sell", "Pampers Confort Sec", "M", 36, 5290, "Savassi"],
  ["demo-2", "sell", "Huggies Supreme Care", "G", 30, 4890, "Funcionários"],
  ["demo-3", "donate", "MamyPoko Dia & Noite", "M", 42, null, "Lourdes"],
  ["demo-4", "sell", "Cremer Magic Care", "P", 34, 3990, "Santa Efigênia"],
  ["demo-5", "buy", "Pampers Pants", "XG", 28, null, "Floresta"],
  ["demo-6", "sell", "Huggies Tripla Proteção", "G", 40, 5190, "Buritis"],
  ["demo-7", "donate", "Personal Baby", "M", 32, null, "Sion"],
  ["demo-8", "sell", "Babysec UltraSec", "G", 36, 4290, "Cidade Nova"],
  ["demo-9", "buy", "Pampers Premium Care", "P", 28, null, "Castelo"],
  ["demo-10", "sell", "Huggies Natural Care", "M", 44, 5390, "Pampulha"],
].map(([id, type, brand, diaperSize, units, priceCents, neighborhood]) => ({
  id, type, brand, diaperSize, units, priceCents,
  sealed: true,
  ownerEmail: "comunidade@tester.fraldacycle.local",
  location: { city: "Belo Horizonte", state: "MG", neighborhood },
}));

function getDemoListings() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_LISTINGS_KEY)) ?? demoListings;
  } catch {
    return demoListings;
  }
}

function demoResponse(body, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }));
}

async function apiFetch(url, options = {}) {
  if (!DEMO_MODE) return window.fetch(url, options);

  const requestUrl = new URL(url, window.location.origin);
  const path = requestUrl.pathname.replace(/^\/demo-api/, "");
  const method = options.method ?? "GET";

  if (path.startsWith("/auth/") && method === "POST") {
    const credentials = JSON.parse(options.body);
    if (!credentials.email.endsWith("@tester.fraldacycle.local")) {
      return demoResponse({ error: "Use um e-mail @tester.fraldacycle.local nesta demonstração." }, 400);
    }
    return demoResponse({
      token: "demo-session",
      user: { id: "demo-user", email: credentials.email },
    });
  }

  if (path === "/listings" && method === "GET") {
    const city = requestUrl.searchParams.get("city")?.toLowerCase();
    const state = requestUrl.searchParams.get("state")?.toLowerCase();
    const type = requestUrl.searchParams.get("type");
    const listings = getDemoListings().filter((listing) =>
      (!city || listing.location.city.toLowerCase().includes(city)) &&
      (!state || listing.location.state.toLowerCase() === state) &&
      (!type || listing.type === type),
    );
    return demoResponse({ listings });
  }

  if (path === "/my/listings" && method === "GET") {
    return demoResponse({ listings: getDemoListings().filter((listing) => listing.ownerEmail === user?.email) });
  }

  if (path === "/listings" && method === "POST") {
    const listing = {
      ...JSON.parse(options.body),
      id: `demo-${Date.now()}`,
      ownerEmail: user.email,
    };
    const listings = [listing, ...getDemoListings()];
    localStorage.setItem(DEMO_LISTINGS_KEY, JSON.stringify(listings));
    return demoResponse({ listing }, 201);
  }

  if (path.startsWith("/listings/") && method === "DELETE") {
    const id = decodeURIComponent(path.slice("/listings/".length));
    localStorage.setItem(DEMO_LISTINGS_KEY, JSON.stringify(getDemoListings().filter((listing) => listing.id !== id)));
    return demoResponse({ removed: true });
  }

  return demoResponse({ error: "Recurso demonstrativo indisponível." }, 404);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js"));
}

function syncQuickFilters(type = "") {
  quickFilters.forEach((filter) => {
    const isActive = filter.dataset.filterType === type;
    filter.classList.toggle("active", isActive);
    filter.setAttribute("aria-pressed", String(isActive));
  });
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.className = isError ? "error" : "";
}

function setAuthMessage(text, isError = false) {
  authMessage.textContent = text;
  authMessage.className = isError ? "error" : "";
}

function clearSession() {
  token = null;
  user = null;
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
  updateSession();
}

function updateSession() {
  const signedIn = Boolean(token && user);
  authForm.hidden = signedIn;
  logoutButton.hidden = !signedIn;
  myListingsPanel.hidden = !signedIn;
  sessionInfo.textContent = signedIn ? `Conectado como ${user.email}.` : "Entre para publicar seus anúncios.";

  if (signedIn) {
    setAuthMessage("");
    loadMyListings();
  } else {
    myListingResults.replaceChildren();
  }
}

function updateAuthAction() {
  const action = new FormData(authForm).get("action");
  authForm.querySelector('button[type="submit"]').textContent =
    action === "register" ? "Criar conta" : "Entrar";
  passwordInput.autocomplete = action === "register" ? "new-password" : "current-password";
}

function updatePriceField() {
  const type = new FormData(form).get("type");
  const priceInput = form.elements.price;
  const guidance = {
    sell: "Venda: informe um preço para seu pacote fechado.",
    buy: "Compra: descreva o tamanho e a quantidade que sua família procura.",
    donate: "Doação: publique um pacote fechado para apoiar outra família.",
  };
  priceField.hidden = type === "donate";
  priceInput.required = type === "sell";
  if (type === "donate") priceInput.value = "";
  publishGuidance.textContent = guidance[type];
}

function fallbackPhoto(listing) {
  const palettes = [
    ["#dff7e7", "#087f3f", "#f8d14b"],
    ["#dbeafe", "#2563eb", "#f59e0b"],
    ["#f3e8ff", "#7c3aed", "#fb7185"],
    ["#ffedd5", "#ea580c", "#22c55e"],
  ];
  const seed = Array.from(listing.brand).reduce((total, character) => total + character.charCodeAt(0), 0);
  const [surface, primary, accent] = palettes[seed % palettes.length];
  const name = String(listing.brand).slice(0, 18).replace(/[&<>]/g, "");
  const size = String(listing.diaperSize).slice(0, 4).replace(/[&<>]/g, "");
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" role="img" aria-label="Pacote demonstrativo">',
    '<rect width="640" height="480" rx="40" fill="' + surface + '"/>',
    '<circle cx="535" cy="74" r="66" fill="' + accent + '" opacity=".23"/>',
    '<circle cx="100" cy="420" r="110" fill="' + primary + '" opacity=".12"/>',
    '<path d="M0 360C140 305 226 424 382 369c88-31 176-42 258-3v114H0z" fill="' + primary + '" opacity=".13"/>',
    '<g transform="translate(150 74)">',
    '<rect x="0" y="15" width="338" height="278" rx="26" fill="#fff" stroke="' + primary + '" stroke-width="9"/>',
    '<rect x="0" y="15" width="338" height="64" rx="26" fill="' + primary + '"/>',
    '<text x="169" y="57" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="24" fill="#fff">FraldaCycle</text>',
    '<circle cx="169" cy="160" r="57" fill="' + accent + '" opacity=".28"/>',
    '<path d="M137 164c9-38 43-55 73-30 28 24 14 70-28 70-36 0-57-19-45-40z" fill="' + primary + '"/>',
    '<text x="169" y="249" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="31" fill="#0f172a">' + name + '</text>',
    '<text x="169" y="278" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#475569">Tamanho ' + size + ' · pacote fechado</text>',
    '</g>',
    '<text x="320" y="424" text-anchor="middle" font-family="Arial,sans-serif" font-size="19" font-weight="700" fill="' + primary + '">♻ economia circular para famílias</text>',
    '</svg>',
  ].join("");
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function createListingCard(listing, { canDelete = false } = {}) {
  const card = document.createElement("article");
  card.className = "listing";

  const image = document.createElement("img");
  image.className = "listing-photo";
  image.src = listing.photoUrl || fallbackPhoto(listing);
  image.alt = `Pacote ${listing.brand}, tamanho ${listing.diaperSize}`;
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.src = fallbackPhoto(listing);
  }, { once: true });

  const content = document.createElement("div");
  content.className = "listing-content";
  const meta = document.createElement("div");
  meta.className = "listing-meta";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = labels[listing.type];
  const sealed = document.createElement("span");
  sealed.className = "sealed-status";
  sealed.textContent = "✓ Fechado";
  meta.append(badge, sealed);

  const title = document.createElement("h3");
  title.textContent = `${listing.brand} · tamanho ${listing.diaperSize}`;
  const details = document.createElement("p");
  details.className = "listing-details";
  details.textContent = `${listing.units} unidades`;
  const location = document.createElement("p");
  location.className = "listing-location";
  location.textContent = `⌖ ${listing.location.city}/${listing.location.state}`;
  content.append(meta, title, details, location);

  if (listing.priceCents) {
    const price = document.createElement("p");
    price.className = "price";
    price.textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(listing.priceCents / 100);
    content.append(price);
  }

  if (canDelete) {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "danger";
    removeButton.dataset.listingId = listing.id;
    removeButton.textContent = "Remover anúncio";
    content.append(removeButton);
  } else {
    const action = document.createElement("a");
    action.className = "listing-action";
    action.href = "/map.html";
    action.textContent = "Ver no mapa →";
    content.append(action);
  }

  card.append(image, content);
  return card;
}

async function readResponse(response) {
  const body = await response.json();
  if (!response.ok) {
    if (response.status === 401) clearSession();
    throw new Error(body.errors?.join(" ") ?? body.error);
  }
  return body;
}

async function loadListings() {
  syncQuickFilters(searchForm.elements.type.value);
  const query = new URLSearchParams(Object.fromEntries([...new FormData(searchForm)].filter(([, value]) => value.trim())));
  results.replaceChildren();
  results.textContent = "Carregando anúncios...";

  try {
    const { listings } = await readResponse(await apiFetch(`${API_URL}/listings?${query}`));
    results.replaceChildren();
    if (listings.length === 0) {
      results.textContent = "Nenhuma oferta encontrada.";
      results.className = "results empty";
      return;
    }
    results.className = "results listing-grid";
    listings.forEach((listing) => results.append(createListingCard(listing)));
  } catch (error) {
    results.textContent = error.message;
    results.className = "results error";
  }
}

async function loadMyListings() {
  if (!token) return;
  myListingResults.replaceChildren();
  myListingResults.textContent = "Carregando seus anúncios...";
  try {
    const { listings } = await readResponse(await apiFetch(`${API_URL}/my/listings`, { headers: { authorization: `Bearer ${token}` } }));
    myListingResults.replaceChildren();
    if (listings.length === 0) {
      myListingResults.textContent = "Você ainda não publicou anúncios.";
      myListingResults.className = "results empty";
      return;
    }
    myListingResults.className = "results listing-grid";
    listings.forEach((listing) => myListingResults.append(createListingCard(listing, { canDelete: true })));
  } catch (error) {
    myListingResults.textContent = error.message;
    myListingResults.className = "results error";
  }
}

async function deleteListing(id) {
  if (!window.confirm("Remover este anúncio?")) return;
  try {
    await readResponse(await apiFetch(`${API_URL}/listings/${encodeURIComponent(id)}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } }));
    await Promise.all([loadListings(), loadMyListings()]);
  } catch (error) {
    myListingResults.textContent = error.message;
    myListingResults.className = "results error";
  }
}

passwordToggle.addEventListener("click", () => {
  const visible = passwordInput.type === "text";
  passwordInput.type = visible ? "password" : "text";
  passwordToggle.textContent = visible ? "Mostrar" : "Ocultar";
  passwordToggle.setAttribute("aria-label", visible ? "Mostrar senha" : "Ocultar senha");
});

authForm.addEventListener("change", (event) => {
  if (event.target.name === "action") updateAuthAction();
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(authForm));
  setAuthMessage(values.action === "register" ? "Criando conta..." : "Entrando...");
  try {
    const body = await readResponse(await apiFetch(`${API_URL}/auth/${values.action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: values.email, password: values.password }),
    }));
    token = body.token;
    user = body.user;
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    authForm.reset();
    updateSession();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
});

logoutButton.addEventListener("click", () => {
  clearSession();
  setAuthMessage("Sessão encerrada.");
});

form.addEventListener("change", (event) => {
  if (event.target.name === "type") updatePriceField();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!token) return setMessage("Entre ou crie uma conta antes de publicar.", true);
  setMessage("Publicando anúncio...");
  const values = Object.fromEntries(new FormData(form));
  const listing = {
    type: values.type,
    sealed: true,
    brand: values.brand,
    diaperSize: values.diaperSize,
    units: Number(values.units),
    photoUrl: values.photoUrl || undefined,
    location: { city: values.city, state: values.state },
  };
  if (values.type === "sell") listing.priceCents = Math.round(Number(values.price) * 100);

  try {
    await readResponse(await apiFetch(`${API_URL}/listings`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(listing),
    }));
    form.reset();
    updatePriceField();
    setMessage("Anúncio publicado com sucesso. Ele será enviado para moderação.");
    await Promise.all([loadListings(), loadMyListings()]);
  } catch (error) {
    setMessage(error.message, true);
  }
});

myListingResults.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-listing-id]");
  if (button) deleteListing(button.dataset.listingId);
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadListings();
});

quickFilters.forEach((filter) => {
  filter.addEventListener("click", () => {
    searchForm.elements.type.value = filter.dataset.filterType;
    loadListings();
  });
});

document.querySelector("#refresh").addEventListener("click", loadListings);
document.querySelector("#refresh-mine").addEventListener("click", loadMyListings);

updateAuthAction();
updatePriceField();
updateSession();
loadListings();
