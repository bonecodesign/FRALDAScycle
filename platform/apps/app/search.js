import "/packages/ui/iconography.js";
import { renderAppSearch } from "/packages/contracts/marketplace-ui.js";

const input = document.getElementById("app-search-input");
const button = document.getElementById("app-search-submit");

input?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && button && !button.disabled) button.click();
});

void renderAppSearch();
