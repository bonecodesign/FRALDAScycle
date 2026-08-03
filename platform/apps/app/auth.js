import { apiRequest, ApiError } from "/packages/contracts/api-client.js";

function notify(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
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
        notify("Novo código enviado com sucesso");
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
      notify("Senha atualizada com sucesso");
      location.pathname = "/app/login";
    } catch (error) { fail(reset, error); restore(); }
  });

  document.getElementById("auth-retry")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.innerHTML = '<span class="inline-spinner"></span> Verificando conexão...';
    try {
      await apiRequest("/health");
      notify("Conexão restabelecida");
      location.pathname = "/app/login";
    } catch {
      notify("Conexão ainda indisponível");
      button.disabled = false;
      button.textContent = "Tentar novamente";
    }
  });
}

setupAuthValidation();
