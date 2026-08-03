import { renderSiteSearch } from "/packages/contracts/marketplace-ui.js";
import "/apps/site/home.js";

const products = [
  { name: "Pampers Confort", detail: "M · 50 unidades", price: "R$ 45,00", distance: "0,8 km" },
  { name: "Huggies Supreme", detail: "G · 40 unidades", price: "R$ 40,00", distance: "1,2 km" },
  { name: "Babysec Premium", detail: "P · 60 unidades", price: "R$ 50,00", distance: "1,4 km" },
  { name: "MamyPoko Fralda-Calça", detail: "XG · 32 unidades", price: "R$ 38,00", distance: "1,6 km" },
];

const preview = document.querySelector("#map-preview");
document.querySelectorAll("[data-map-product]").forEach((marker) => {
  marker.addEventListener("click", () => {
    document.querySelectorAll("[data-map-product]").forEach((item) => item.classList.remove("active"));
    marker.classList.add("active");
    const product = products[Number(marker.dataset.mapProduct)];
    preview.innerHTML = `<strong>${product.name}</strong><small>${product.detail} · ${product.distance}</small><a class="button secondary block small" href="/site/detail">Ver detalhes</a>`;
  });
});

document.querySelectorAll(".filters .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    chip.classList.toggle("active");
    chip.setAttribute("aria-pressed", String(chip.classList.contains("active")));
  });
});

const query = document.querySelector("#q");
const cards = [...document.querySelectorAll(".product-card")];
query?.addEventListener("input", () => {
  const term = query.value.trim().toLocaleLowerCase("pt-BR");
  cards.forEach((card) => {
    card.hidden = term.length > 0 && !card.textContent.toLocaleLowerCase("pt-BR").includes(term);
  });
});

renderSiteSearch();
