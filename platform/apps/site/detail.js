import "/apps/site/home.js";

const favorite = document.querySelector('[data-action="favorite"]');
favorite?.addEventListener("click", () => {
  const active = favorite.classList.toggle("active");
  favorite.setAttribute("aria-pressed", String(active));
  favorite.textContent = active ? "♥ Favoritado" : "♡ Favoritar";
});
