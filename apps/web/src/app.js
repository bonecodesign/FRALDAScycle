const API_URL = window.FRALDACYCLE_API_URL ?? "http://localhost:3000";
const AUTH_TOKEN_KEY = "fraldacycle.token";
const AUTH_USER_KEY = "fraldacycle.user";

const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const sessionInfo = document.querySelector("#session-info");
const logoutButton = document.querySelector("#logout");
const form = document.querySelector("#listing-form");
const searchForm = document.querySelector("#search-form");
const priceField = document.querySelector("#price-field");
const message = document.querySelector("#form-message");
const results = document.querySelector("#listing-results");

let token = sessionStorage.getItem(AUTH_TOKEN_KEY);
let user;

try {
  user = JSON.parse(sessionStorage.getItem(AUTH_USER_KEY));
} catch {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
  token = null;
}

const labels = {
  buy: "Compra",
  sell: "Venda",
  donate: "Doação",
};

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
  sessionInfo.textContent = signedIn
    ? `Conectado como ${user.email}.`
    : "Entre para publicar seus anúncios.";

  if (signedIn) {
    setAuthMessage("");
  }
}

function updateAuthAction() {
  const action = new FormData(authForm).get("action");
  authForm.querySelector('button[type="submit"]').textContent =
    action === "register" ? "Criar conta" : "Entrar";
}

function updatePriceField() {
  const type = new FormData(form).get("type");
  const priceInput = form.elements.price;

  priceField.hidden = type === "donate";
  priceInput.required = type === "sell";

  if (type === "donate") {
    priceInput.value = "";
  }
}

function createListingCard(listing) {
  const card = document.createElement("article");
  card.className = "listing";

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = labels[listing.type];

  const title = document.createElement("h3");
  title.textContent = `${listing.brand} · tamanho ${listing.diaperSize}`;

  const details = document.createElement("p");
  details.textContent = `${listing.units} unidades · ${listing.location.city}/${listing.location.state}`;

  card.append(badge, title, details);

  if (listing.priceCents) {
    const price = document.createElement("p");
    price.textContent = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(listing.priceCents / 100);
    card.append(price);
  }

  return card;
}

async function loadListings() {
  const query = new URLSearchParams(
    Object.fromEntries(
      [...new FormData(searchForm)].filter(([, value]) => value.trim()),
    ),
  );

  results.replaceChildren();
  results.textContent = "Carregando anúncios...";

  try {
    const response = await fetch(`${API_URL}/listings?${query}`);
    const { listings } = await response.json();

    if (!response.ok) {
      throw new Error("Não foi possível carregar os anúncios.");
    }

    results.replaceChildren();

    if (listings.length === 0) {
      results.textContent = "Nenhuma oferta encontrada.";
      results.className = "results empty";
      return;
    }

    results.className = "results";
    listings.forEach((listing) => results.append(createListingCard(listing)));
  } catch (error) {
    results.textContent = error.message;
    results.className = "results error";
  }
}

authForm.addEventListener("change", (event) => {
  if (event.target.name === "action") {
    updateAuthAction();
  }
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const values = Object.fromEntries(new FormData(authForm));
  setAuthMessage(values.action === "register" ? "Criando conta..." : "Entrando...");

  try {
    const response = await fetch(`${API_URL}/auth/${values.action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: values.email,
        password: values.password,
      }),
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error);
    }

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
  if (event.target.name === "type") {
    updatePriceField();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!token) {
    setMessage("Entre ou crie uma conta antes de publicar.", true);
    return;
  }

  setMessage("Publicando anúncio...");

  const values = Object.fromEntries(new FormData(form));
  const listing = {
    type: values.type,
    sealed: true,
    brand: values.brand,
    diaperSize: values.diaperSize,
    units: Number(values.units),
    location: {
      city: values.city,
      state: values.state,
    },
  };

  if (values.type === "sell") {
    listing.priceCents = Math.round(Number(values.price) * 100);
  }

  try {
    const response = await fetch(`${API_URL}/listings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(listing),
    });
    const body = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        clearSession();
      }

      throw new Error(body.errors?.join(" ") ?? body.error);
    }

    form.reset();
    updatePriceField();
    setMessage("Anúncio publicado com sucesso.");
    await loadListings();
  } catch (error) {
    setMessage(error.message, true);
  }
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadListings();
});

document.querySelector("#refresh").addEventListener("click", loadListings);

updateAuthAction();
updatePriceField();
updateSession();
loadListings();
