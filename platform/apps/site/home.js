const themeToggle = document.querySelector("#theme-toggle");
const storedTheme = localStorage.getItem("fraldacycle-theme") === "dark" ? "dark" : "light";

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle?.setAttribute("aria-pressed", String(theme === "dark"));
}

applyTheme(storedTheme);

const hero = document.querySelector(".hero");
const heroTitle = hero?.querySelector("h1");
const heroText = hero?.querySelector("p");
const heroActions = hero?.querySelector(".hero-actions");
if (heroTitle) heroTitle.innerHTML = "Conectamos famílias.<br><span>Reduzimos desperdícios.</span><br>Transformamos vidas.";
if (heroText) heroText.textContent = "Compre ou troque pacotes fechados. Doe pacotes fechados ou abertos, desde que estejam sem uso e com higiene confirmada.";
if (heroActions) heroActions.innerHTML = '<a class="button primary" href="/site/search">Começar agora</a><a class="button secondary" href="#como-funciona">Saiba mais</a>';

const howItWorks = document.querySelector(".feature-grid")?.closest(".section");
if (howItWorks) howItWorks.id = "como-funciona";
const marketplace = document.querySelector(".marketplace");
if (marketplace) marketplace.id = "categorias";

const iconPaths = [
  '<circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/>',
  '<path d="M7 7h11l-3-3m3 3-3 3M17 17H6l3 3m-3-3 3-3"/>',
  '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
  '<path d="M3 11h18M5 11V7h10l4 4v6H5Z"/><circle cx="8" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
];
document.querySelectorAll(".feature-card .icon").forEach((node, index) => {
  node.innerHTML = `<svg class="fc-icon" aria-hidden="true" viewBox="0 0 24 24">${iconPaths[index]}</svg>`;
});

themeToggle?.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("fraldacycle-theme", next);
  applyTheme(next);
});

document.querySelectorAll(".favorite").forEach((button) => {
  button.innerHTML = '<svg class="fc-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
  button.addEventListener("click", () => {
    const active = button.classList.toggle("active");
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? "Remover dos favoritos" : "Adicionar aos favoritos");
  });
});
