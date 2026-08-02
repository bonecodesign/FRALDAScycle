const themeToggle = document.querySelector("#theme-toggle");
const storedTheme = localStorage.getItem("fraldacycle-theme") === "dark" ? "dark" : "light";

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle?.setAttribute("aria-pressed", String(theme === "dark"));
  if (themeToggle) themeToggle.querySelector("span").textContent = theme === "dark" ? "☀" : "◐";
}

applyTheme(storedTheme);

themeToggle?.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("fraldacycle-theme", next);
  applyTheme(next);
});

document.querySelectorAll(".favorite").forEach((button) => {
  button.addEventListener("click", () => {
    const active = button.classList.toggle("active");
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? "Remover dos favoritos" : "Adicionar aos favoritos");
  });
});
