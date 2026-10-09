import { bindFavoriteButtons, loadLiveSearch } from "/packages/contracts/marketplace-ui.js";

const target = document.getElementById("app-home-listings");

async function loadHomeListings() {
  if (!target) return;
  try {
    const { items, markup } = await loadLiveSearch({ surface: "app" });
    target.innerHTML = items.length
      ? `<div class="phone-list">${markup}</div>`
      : '<div class="ui-state empty-state"><div class="state-icon">⌕</div><h2>Nenhum anúncio disponível</h2><p>Novos anúncios publicados aparecerão aqui.</p><a class="button primary block" href="/app/publish-1">Publicar anúncio</a></div>';
    bindFavoriteButtons(target);
  } catch (error) {
    target.innerHTML = `<div class="ui-state error-state"><h2>Não foi possível carregar os anúncios</h2><p>${error.message}</p><button class="button secondary" id="app-home-retry" type="button">Tentar novamente</button></div>`;
    document.getElementById("app-home-retry")?.addEventListener("click", loadHomeListings, { once: true });
  }
}

void loadHomeListings();
