document.querySelectorAll(".favorite").forEach((button) => {
  button.addEventListener("click", () => {
    const card = button.closest(".phone-card");
    card?.remove();
    const list = document.querySelector(".phone-list");
    if (list && !list.querySelector(".phone-card")) {
      list.innerHTML = '<div class="ui-state empty-state"><div class="state-icon">♡</div><h2>Nenhum favorito salvo</h2><p>Os anúncios favoritados aparecerão aqui.</p><a class="button primary block" href="/app/search">Buscar produtos</a></div>';
    }
  });
});

document.querySelectorAll(".segmented button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".segmented button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
});
