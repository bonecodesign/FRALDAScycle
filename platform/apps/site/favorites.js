import "/apps/site/home.js";

const products = [
  { name: "Pampers Confort", detail: "M · 50 unidades", price: "R$ 45,00", distance: "0,8 km", asset: "pampers" },
  { name: "Huggies Supreme", detail: "G · 40 unidades", price: "R$ 40,00", distance: "1,2 km", asset: "huggies" },
  { name: "Babysec Premium", detail: "P · 60 unidades", price: "R$ 50,00", distance: "1,4 km", asset: "babysec" },
  { name: "MamyPoko Fralda-Calça", detail: "XG · 32 unidades", price: "R$ 38,00", distance: "1,6 km", asset: "mamypoko" },
];
const content = document.querySelector("#site-favorites-content");
const toast = document.querySelector("#toast");
let saved = [0, 1, 3];

function notify(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function draw() {
  if (!saved.length) {
    content.innerHTML = '<div class="ui-state empty-state"><div class="state-icon">♡</div><h2>Nenhum favorito salvo</h2><p>Quando você favoritar um anúncio, ele aparecerá aqui.</p><a class="button primary" href="/site/search">Explorar anúncios</a></div>';
    return;
  }
  content.innerHTML = `<div class="product-grid">${saved.map((index) => {
    const product = products[index];
    return `<article class="product-card" data-site-favorite="${index}"><button class="favorite active" type="button" data-remove-site-favorite="${index}" aria-label="Remover ${product.name} dos favoritos">♥</button><div class="product-image approved-product-stage"><img class="approved-product" src="/source/assets/approved/${product.asset}-approved.png" alt="Embalagem ${product.name} aprovada no acervo"></div><div class="product-body"><span class="badge">Salvo</span><h3>${product.name}</h3><p>${product.detail}</p><div class="price">${product.price}</div><div class="meta"><span>★ 4,9</span><span>${product.distance}</span></div><a class="button secondary block small" href="/site/detail">Ver detalhes</a></div></article>`;
  }).join("")}</div>`;
  content.querySelectorAll("[data-remove-site-favorite]").forEach((button) => button.addEventListener("click", () => {
    saved = saved.filter((index) => index !== Number(button.dataset.removeSiteFavorite));
    draw();
    notify("Removido dos favoritos");
  }));
}

window.setTimeout(draw, 420);
document.querySelector("#site-favorites-clear")?.addEventListener("click", () => {
  saved = [];
  draw();
  notify("Lista de favoritos limpa");
});
