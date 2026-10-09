import "/packages/ui/iconography.js";
import { apiRequest } from "/packages/contracts/api-client.js";

const ADMIN_ROLES = new Set(["admin", "moderator"]);
const ROLE_NAVIGATION = {
  admin: ["dashboard", "users", "roles", "ads", "operations", "finance", "logistics", "reports", "data", "forecast", "infrastructure", "partnerships", "innovation", "launch", "alerts", "moderation", "audit", "settings", "security"],
  moderator: ["dashboard", "users", "ads", "operations", "logistics", "reports", "alerts", "moderation", "audit"],
};

function applyNavigationScope(role) {
  const allowed = new Set(ROLE_NAVIGATION[role] ?? []);
  document.querySelectorAll(".admin-sidebar a[href^='/admin/']").forEach(link => {
    const section = link.getAttribute("href").split("/").at(-1);
    const visible = allowed.has(section);
    link.hidden = !visible;
    link.toggleAttribute("aria-hidden", !visible);
  });
  document.documentElement.dataset.adminRole = role;
}

function addEnvironmentDisclosure(label) {
  const head = document.querySelector(".admin-head");
  if (!head || head.querySelector("[data-environment-disclosure]")) return;
  const disclosure = document.createElement("p");
  disclosure.className = "notice admin-environment-disclosure";
  disclosure.dataset.environmentDisclosure = "true";
  disclosure.setAttribute("role", "note");
  disclosure.textContent = label;
  head.after(disclosure);
}

function showLoginError(message) {
  const error = document.getElementById("admin-login-error");
  if (error) error.textContent = message;
}

async function handleLogin() {
  const form = document.getElementById("admin-login-form");
  const mfaForm = document.getElementById("admin-mfa-form");
  if (!form || !mfaForm) return;
  let activeChallenge = null;
  let expiresAt = 0;
  let busy = false;
  let expiryTimer;
  const restartButton = document.getElementById('admin-mfa-restart');
  const codeError = document.getElementById('admin-mfa-error');
  const codeSubmit = mfaForm.querySelector('[type="submit"]');
  const clearChallenge = () => {
    activeChallenge = null;
    expiresAt = 0;
    clearInterval(expiryTimer);
    mfaForm.elements.code.value = '';
    codeSubmit.disabled = true;
  };
  const checkExpiry = () => {
    if (activeChallenge && Date.now() >= expiresAt) {
      clearChallenge();
      if (codeError) codeError.textContent = 'O código expirou. Reinicie o acesso para solicitar outro.';
    }
  };

  try {
    const session = await apiRequest("/v1/auth/session");
    if (ADMIN_ROLES.has(session.user?.role)) location.replace("/admin/dashboard");
  } catch {}

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || form.hidden) return;
    busy = true;
    showLoginError("");
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const credentials = { email: form.elements.email.value.trim(), password: form.elements.password.value };
      form.elements.password.value = '';
      const result = await apiRequest("/v1/auth/login", {
        method: "POST",
        body: credentials,
      });
      if (result.mfaRequired === true) {
        const expiry = Date.parse(result.expiresAt);
        if (!/^[A-Za-z0-9_-]{43}$/.test(result.challenge ?? '') || !Number.isFinite(expiry) || expiry <= Date.now()) {
          throw new Error('Não foi possível iniciar a confirmação. Tente entrar novamente.');
        }
        activeChallenge = result.challenge;
        expiresAt = Math.min(expiry, Date.now() + 5 * 60 * 1000);
        clearInterval(expiryTimer);
        expiryTimer = setInterval(checkExpiry, 1000);
        form.hidden = true;
        mfaForm.hidden = false;
        mfaForm.elements.code.value = "";
        if (codeError) codeError.textContent = '';
        codeSubmit.disabled = false;
        mfaForm.elements.code.focus();
        submit.disabled = false;
        return;
      }
      await apiRequest("/v1/auth/logout", { method: "POST" }).catch(() => {});
      throw new Error(ADMIN_ROLES.has(result.user?.role) ? 'O acesso administrativo exige confirmação em duas etapas.' : 'Esta conta não possui acesso administrativo.');
    } catch (error) {
      showLoginError(error.message || "Não foi possível entrar.");
      submit.disabled = false;
    } finally {
      busy = false;
      submit.disabled = false;
    }
  });

  mfaForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || mfaForm.hidden) return;
    checkExpiry();
    const error = document.getElementById("admin-mfa-error");
    const submit = mfaForm.querySelector('[type="submit"]');
    if (error) error.textContent = "";
    const code = mfaForm.elements.code.value.replace(/\D/g, "");
    if (!activeChallenge || !/^\d{6}$/.test(code)) {
      if (error) error.textContent = activeChallenge ? "Digite os 6 dígitos do código." : 'Reinicie o acesso para solicitar um novo código.';
      return;
    }
    submit.disabled = true;
    busy = true;
    if (restartButton) restartButton.disabled = true;
    try {
      const result = await apiRequest("/v1/auth/mfa/confirm", {
        method: "POST", body: { challenge: activeChallenge, code },
      });
      if (!ADMIN_ROLES.has(result.user?.role)) {
        await apiRequest("/v1/auth/logout", { method: "POST" }).catch(() => {});
        clearChallenge();
        throw new Error("Esta conta não possui acesso administrativo.");
      }
      clearChallenge();
      location.replace("/admin/dashboard");
    } catch (requestError) {
      if (error) error.textContent = requestError.message || "Não foi possível confirmar o código.";
      if (requestError.status === 429 || requestError.code === 'too_many_attempts') clearChallenge();
    } finally {
      busy = false;
      if (restartButton) restartButton.disabled = false;
      checkExpiry();
      submit.disabled = !activeChallenge;
    }
  });

  document.getElementById("admin-mfa-restart")?.addEventListener("click", () => {
    if (busy) return;
    clearChallenge();
    mfaForm.hidden = true;
    form.hidden = false;
    form.elements.password.value = "";
    showLoginError('');
    if (codeError) codeError.textContent = '';
    form.elements.password.focus();
  });
}

async function requireAdmin() {
  if (location.pathname === "/admin/login") return handleLogin();
  document.documentElement.dataset.adminAuth = "pending";
  try {
    const result = await apiRequest("/v1/auth/session");
    if (!ADMIN_ROLES.has(result.user?.role)) throw new Error("forbidden");
    document.documentElement.dataset.adminAuth = "ready";
    applyNavigationScope(result.user.role);
    addEnvironmentDisclosure(`Sessão autenticada · perfil ${result.user.role === "admin" ? "administrador" : "moderação"}. Os módulos visíveis seguem o princípio do menor privilégio.`);
    const head = document.querySelector(".admin-head > div:last-child");
    if (head) {
      const logout = document.createElement("button");
      logout.className = "button ghost small";
      logout.type = "button";
      logout.textContent = "Sair";
      logout.addEventListener("click", async () => {
        logout.disabled = true;
        await apiRequest("/v1/auth/logout", { method: "POST" }).catch(() => {});
        location.replace("/admin/login");
      });
      head.append(logout);
    }
  } catch {
    location.replace("/admin/login");
    await new Promise(() => {});
  }
}

await requireAdmin();
