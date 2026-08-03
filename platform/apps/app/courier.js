function notify(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

const photoButton = document.querySelector(".panel .button.secondary");
photoButton?.addEventListener("click", () => {
  photoButton.disabled = true;
  photoButton.textContent = "Foto adicionada";
  photoButton.closest(".panel")?.classList.add("ready");
  notify("Foto e localização registradas com segurança");
});

document.querySelector('[data-action="delivery"]')?.addEventListener("click", () => {
  notify("Recebimento confirmado");
});
