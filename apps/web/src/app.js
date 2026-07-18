const API_URL = window.FRALDACYCLE_API_URL ?? "http://localhost:3000";

const form = document.querySelector("#listing-form");
const searchForm = document.querySelector("#search-form");
const priceField = document.querySelector("#price-field");
const message = document.querySelector("#form-message");
const results = document.querySelector("#listing-results");

const labels = {
  buy: "Compra",
  sell: "Venda",
  donate: "Doação",
};

function setMessage(text, isError = false) {
  message.textContent = text;
  message.className = isError ? "error" : "";
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

form.addEventListener("change", (event) => {
  if (event.target.name === "type") {
    updatePriceField();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify(listing),
    });
    const body = await response.json();

    if (!response.ok) {
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

updatePriceField();
loadListings();
