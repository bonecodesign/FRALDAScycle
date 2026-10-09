import "/packages/ui/iconography.js";
import { renderAppSearch } from "/packages/contracts/marketplace-ui.js";

const input = document.getElementById("app-search-input");
const type = document.getElementById("app-filter-type");
const size = document.getElementById("app-filter-size");
const results = document.getElementById("app-search-results");
const button = document.getElementById("app-search-submit");

document.getElementById("app-filter-reset")?.addEventListener("click", () => {
  input.value = "";
  type.value = "";
  size.value = "";
  button.textContent = "Buscar anúncios";
  results.innerHTML = '<div class="ui-state empty-state"><div class="state-icon">⌕</div><h2>Faça uma busca</h2><p>Os resultados serão consultados diretamente no marketplace.</p></div>';
});

input?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") button.click();
});

void renderAppSearch();
