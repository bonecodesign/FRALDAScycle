import "/packages/ui/iconography.js";
import { apiRequest } from "/packages/contracts/api-client.js";
import { money, setFavorite } from "/packages/contracts/marketplace-ui.js";
import "/apps/site/home.js";

const listingId = new URLSearchParams(location.search).get("id");
const content = document.getElementById("site-detail-content");

function text(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

async function loadDetail() {
  if (!content) return;
  if (!listingId) {
    content.innerHTML = '<div class="ui-state empty-state"><h1>Anúncio não selecionado</h1><p>Volte à busca e escolha um anúncio disponível.</p></div>';
    return;
  }
  try {
    const { listing } = await apiRequest(`/v1/listings/${encodeURIComponent(listingId)}`);
    const layout = document.createElement("div"); layout.className = "auth-layout";
    const image = document.createElement("div"); image.className = "product-image approved-product-stage product-detail-stage";
    image.append(text("span", "Imagem protegida do anúncio", "muted"));
    const body = document.createElement("div"); body.className = "auth-form";
    body.append(text("span", listing.kind === "sale" ? "Venda" : listing.kind === "exchange" ? "Troca" : "Doação", "badge"));
    body.append(text("h1", listing.title));
    body.append(text("div", money(listing.price_cents, listing.kind), "price"));
    body.append(text("p", [listing.city, listing.state].filter(Boolean).join(", ") || "Localização não informada", "muted"));
    body.append(text("h2", "Descrição"), text("p", listing.description));
    body.append(text("p", `Anunciante: ${listing.seller_name || "Conta identificada"}`, "notice"));
    const actions = document.createElement("div"); actions.className = "hero-actions";
    const favorite = text("button", "♡ Favoritar", "button secondary"); favorite.type = "button";
    favorite.addEventListener("click", async () => { try { await setFavorite(listingId, true); favorite.textContent = "♥ Favoritado"; favorite.disabled = true; } catch (error) { if (error.status === 401) location.pathname = "/site/login"; } });
    const negotiate = text("a", listing.kind === "sale" ? "Continuar no App" : listing.kind === "exchange" ? "Propor troca no App" : "Ver orientações da doação", "button primary");
    negotiate.href = `/app/listing?id=${encodeURIComponent(listingId)}`;
    actions.append(favorite, negotiate); body.append(actions); layout.append(image, body); content.replaceChildren(layout);
  } catch (error) {
    content.replaceChildren(text("p", error.message || "Não foi possível carregar o anúncio.", "notice"));
  }
}

void loadDetail();
