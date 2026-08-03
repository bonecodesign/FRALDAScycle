import { setFavorite } from "/packages/contracts/marketplace-ui.js";
import "/apps/site/home.js";

const listingId = new URLSearchParams(location.search).get("id");
const favorite = document.querySelector('[data-action="favorite"]');
favorite?.addEventListener("click", async () => {
  const active = !favorite.classList.contains("active");
  if (listingId) {
    try { await setFavorite(listingId, active); }
    catch (error) { if (error.status === 401) { location.pathname = "/site/login"; return; } }
  }
  favorite.classList.toggle("active", active);
  favorite.setAttribute("aria-pressed", String(active));
  favorite.textContent = active ? "♥ Favoritado" : "♡ Favoritar";
});
