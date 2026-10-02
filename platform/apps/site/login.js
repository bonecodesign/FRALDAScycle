import { notify } from "/packages/ui/notify.js";
import "/apps/site/home.js";
import { apiRequest, ApiError } from "/packages/contracts/api-client.js";

const LOCAL_DEMO = new Set(["127.0.0.1", "localhost"]).has(location.hostname);

if (LOCAL_DEMO) {
  location.replace("/site/home");
}


const form = document.querySelector("[data-demo-form]");
form?.addEventListener("submit", async event => {
  event.preventDefault();
  if (LOCAL_DEMO) {
    location.pathname = "/site/home";
    return;
  }
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
    notify("Informações validadas com sucesso", 2400);
    window.setTimeout(() => { location.pathname = "/site/home"; }, 500);
  } catch (error) {
    notify(error instanceof ApiError ? error.message : "Não foi possível entrar.", 2400);
    button.disabled = false;
    button.textContent = original;
  }
});

