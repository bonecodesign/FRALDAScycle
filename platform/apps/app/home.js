import { bindFavoriteButtons, loadLiveSearch } from "/packages/contracts/marketplace-ui.js";
import { renderSafeErrorState } from "/packages/contracts/safe-error-state.js";

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
    renderSafeErrorState(target, {
      heading: "Não foi possível carregar os anúncios",
      message: error?.message,
      onRetry: loadHomeListings,
    });
  }
}

void loadHomeListings();
