import { notify } from "/packages/ui/notify.js";
import "/packages/ui/iconography.js";
import { apiRequest, ApiError } from "/packages/contracts/api-client.js";

const LOCAL_DEMO = new Set(["127.0.0.1", "localhost"]).has(location.hostname);

const APP_ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5M9 20v-6h6v6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  publish: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  chat: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  swap: '<path d="m7 7-4 4 4 4M3 11h14M17 3l4 4-4 4M21 7H7"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8H7.5a2.5 2.5 0 1 1 2.2-3.7L12 8Zm0 0h4.5a2.5 2.5 0 1 0-2.2-3.7L12 8Z"/>',
  cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.4 10.4A2 2 0 0 0 9.3 16h7.9a2 2 0 0 0 1.9-1.4L21 8H6"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  payment: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  delivery: '<path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
};

function icon(name) {
  return `<svg class="fc-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${APP_ICONS[name] ?? APP_ICONS.home}</svg>`;
}

function setupAppIconography() {
  const root = document.querySelector('main[data-surface="app"]');
  if (root?.dataset.iconified === "true") return;
  const routeIcon = href => {
    if (href.includes("/search")) return "search";
    if (href.includes("/publish")) return "publish";
    if (href.includes("/chat") || href.includes("/negotiation")) return "chat";
    if (href.includes("/profile") || href.includes("/courier")) return "user";
    if (href.includes("/payment") || href.includes("/wallet")) return "payment";
    if (href.includes("/delivery")) return "delivery";
    return "home";
  };

  document.querySelectorAll(".phone-nav a, .app-menu a").forEach(link => {
    const marker = link.querySelector("span");
    if (marker) marker.innerHTML = icon(routeIcon(link.getAttribute("href") ?? ""));
  });

  const actionIcons = { Trocar: "swap", Doar: "gift", Comprar: "cart", Favoritos: "heart" };
  document.querySelectorAll(".quick-action").forEach(action => {
    const label = action.textContent.trim();
    const marker = action.querySelector("span");
    if (marker && actionIcons[label]) marker.innerHTML = icon(actionIcons[label]);
  });

  const notification = document.querySelector(".notification-button");
  if (notification) {
    const badge = notification.querySelector("span");
    notification.innerHTML = icon("bell");
    if (badge) notification.append(badge);
  }

  document.querySelectorAll("button, a").forEach(control => {
    if (["♡", "♥"].includes(control.textContent.trim())) {
      control.innerHTML = icon("heart");
      if (!control.getAttribute("aria-label")) control.setAttribute("aria-label", "Favoritar");
    }
  });
}

function setupSyntheticDataDisclosure() {
  const contextPanel = document.querySelector(".context-panel");
  if (!contextPanel || contextPanel.querySelector("[data-synthetic-disclosure]")) return;
  const disclosure = document.createElement("div");
  disclosure.className = "notice";
  disclosure.dataset.syntheticDisclosure = "true";
  disclosure.setAttribute("role", "note");
  disclosure.textContent = "Dados sintéticos · demonstração local";
  contextPanel.append(disclosure);
}

if (LOCAL_DEMO && location.pathname === "/app/login") {
  location.replace("/app/home");
}


function setupAuthValidation() {
  const contactValid = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.replace(/\D/g, "").length >= 8;
  const showError = (form, message) => {
    const error = form.querySelector(".field-error");
    if (error) error.textContent = message;
    form.querySelectorAll(".input").forEach(input => input.classList.toggle("invalid", !input.checkValidity()));
  };
  const submitState = (form, label) => {
    const button = form.querySelector('[type="submit"]');
    const original = button.textContent;
    button.disabled = true;
    button.innerHTML = `<span class="inline-spinner"></span> ${label}`;
    return () => { button.disabled = false; button.textContent = original; };
  };
  const fail = (form, error) => {
    showError(form, error instanceof ApiError ? error.message : "Não foi possível concluir. Tente novamente.");
  };
  const contactPayload = value => value.includes("@") ? { email: value } : { phone: value };

  const login = document.getElementById("login-form");
  if (login) login.addEventListener("submit", async event => {
    event.preventDefault();
    if (LOCAL_DEMO) {
      location.pathname = "/app/home";
      return;
    }
    const inputs = login.querySelectorAll("input");
    const contact = inputs[0].value.trim();
    if (!contactValid(contact)) return showError(login, "Informe um e-mail ou telefone válido.");
    if (inputs[1].value.length < 6) return showError(login, "A senha precisa ter pelo menos 6 caracteres.");
    const restore = submitState(login, "Entrando...");
    showError(login, "");
    try {
      await apiRequest("/v1/auth/login", { method: "POST", body: { ...contactPayload(contact), password: inputs[1].value } });
      location.pathname = "/app/home";
    } catch (error) { fail(login, error); restore(); }
  });

  const register = document.getElementById("register-form");
  if (register) register.addEventListener("submit", async event => {
    event.preventDefault();
    const inputs = register.querySelectorAll("input");
    const contact = inputs[1].value.trim();
    if (inputs[0].value.trim().length < 3) return showError(register, "Informe seu nome completo.");
    if (!contactValid(contact)) return showError(register, "Informe um e-mail ou telefone válido.");
    if (inputs[2].value.length < 12) return showError(register, "A senha precisa ter pelo menos 12 caracteres.");
    if (inputs[2].value !== inputs[3].value) return showError(register, "As senhas precisam ser iguais.");
    if (!inputs[4].checked) return showError(register, "Aceite os Termos de Uso e a Política de Privacidade.");
    const restore = submitState(register, "Criando conta...");
    showError(register, "");
    try {
      await apiRequest("/v1/auth/register", {
        method: "POST",
        body: { displayName: inputs[0].value.trim(), ...contactPayload(contact), password: inputs[2].value },
      });
      sessionStorage.setItem("fc.auth.contact", contact);
      sessionStorage.setItem("fc.auth.mode", "verification");
      location.pathname = "/app/verify";
    } catch (error) { fail(register, error); restore(); }
  });

  const recovery = document.getElementById("recovery-form");
  if (recovery) recovery.addEventListener("submit", async event => {
    event.preventDefault();
    const input = recovery.querySelector("input");
    const contact = input.value.trim();
    if (!contactValid(contact)) return showError(recovery, "Informe um e-mail ou telefone válido.");
    const restore = submitState(recovery, "Enviando código...");
    showError(recovery, "");
    try {
      await apiRequest("/v1/auth/password/request", { method: "POST", body: contactPayload(contact) });
      sessionStorage.setItem("fc.auth.contact", contact);
      sessionStorage.setItem("fc.auth.mode", "recovery");
      location.pathname = "/app/verify";
    } catch (error) { fail(recovery, error); restore(); }
  });

  const verify = document.getElementById("verify-form");
  if (verify) {
    const digits = [...verify.querySelectorAll(".otp input")];
    const contact = sessionStorage.getItem("fc.auth.contact");
    const target = verify.querySelector("[data-verification-target]");
    if (target && contact) target.textContent = contact;
    digits.forEach((input, index) => {
      input.value = "";
      input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 1);
        if (input.value && digits[index + 1]) digits[index + 1].focus();
      });
      input.addEventListener("keydown", event => {
        if (event.key === "Backspace" && !input.value && digits[index - 1]) digits[index - 1].focus();
      });
    });
    verify.addEventListener("submit", async event => {
      event.preventDefault();
      const token = digits.map(input => input.value).join("");
      if (token.length !== 6) return showError(verify, "Digite os seis números do código.");
      const restore = submitState(verify, "Verificando...");
      try {
        if (sessionStorage.getItem("fc.auth.mode") === "recovery") {
          sessionStorage.setItem("fc.auth.recoveryToken", token);
          location.pathname = "/app/reset-password";
        } else {
          await apiRequest("/v1/auth/verification/confirm", { method: "POST", body: { token } });
          location.pathname = "/app/login";
        }
      } catch (error) { fail(verify, error); restore(); }
    });
    document.getElementById("resend-code")?.addEventListener("click", async () => {
      const mode = sessionStorage.getItem("fc.auth.mode");
      const path = mode === "recovery" ? "/v1/auth/password/request" : "/v1/auth/verification/request";
      try {
        await apiRequest(path, { method: "POST", body: contactPayload(contact ?? "") });
        digits.forEach(input => { input.value = ""; });
        digits[0].focus();
        verify.querySelector(".otp-time").textContent = "Novo código enviado · expira em 10:00";
        notify("Novo código enviado com sucesso", 2400);
      } catch (error) { fail(verify, error); }
    });
  }

  const reset = document.getElementById("reset-password-form");
  if (reset) reset.addEventListener("submit", async event => {
    event.preventDefault();
    const [password, confirmation] = reset.querySelectorAll("input");
    if (password.value.length < 12) return showError(reset, "A senha precisa ter pelo menos 12 caracteres.");
    if (password.value !== confirmation.value) return showError(reset, "As senhas precisam ser iguais.");
    const token = sessionStorage.getItem("fc.auth.recoveryToken");
    if (!token) return showError(reset, "Solicite um novo código de recuperação.");
    const restore = submitState(reset, "Salvando...");
    try {
      await apiRequest("/v1/auth/password/reset", { method: "POST", body: { token, password: password.value } });
      sessionStorage.removeItem("fc.auth.recoveryToken");
      notify("Senha atualizada com sucesso", 2400);
      location.pathname = "/app/login";
    } catch (error) { fail(reset, error); restore(); }
  });

  document.getElementById("auth-retry")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.innerHTML = '<span class="inline-spinner"></span> Verificando conexão...';
    try {
      await apiRequest("/health");
      notify("Conexão restabelecida", 2400);
      location.pathname = "/app/login";
    } catch {
      notify("Conexão ainda indisponível", 2400);
      button.disabled = false;
      button.textContent = "Tentar novamente";
    }
  });
}

setupAuthValidation();
setupAppIconography();
setupSyntheticDataDisclosure();

