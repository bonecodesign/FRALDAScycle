import "/apps/site/home.js";
import { apiRequest, ApiError } from "/packages/contracts/api-client.js";

function notify(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
}

const form = document.querySelector("[data-demo-form]");
form?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const [contact, password] = form.querySelectorAll("input");
  const button = form.querySelector('[type="submit"]');
  const original = button.textContent;
  button.disabled = true;
  button.innerHTML = '<span class="inline-spinner"></span> Entrando...';
  const identity = contact.value.includes("@")
    ? { email: contact.value.trim() }
    : { phone: contact.value.trim() };
  try {
    await apiRequest("/v1/auth/login", {
      method: "POST",
      body: { ...identity, password: password.value },
    });
    notify("Informações validadas com sucesso");
    window.setTimeout(() => { location.pathname = "/site/home"; }, 500);
  } catch (error) {
    notify(error instanceof ApiError ? error.message : "Não foi possível entrar.");
    button.disabled = false;
    button.textContent = original;
  }
});
