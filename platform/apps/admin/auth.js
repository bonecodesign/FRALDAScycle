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

  try {
    const session = await apiRequest("/v1/auth/session");
    if (ADMIN_ROLES.has(session.user?.role)) location.replace("/admin/dashboard");
  } catch {}

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showLoginError("");
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const result = await apiRequest("/v1/auth/login", {
        method: "POST",
        body: {
          email: form.elements.email.value.trim(),
          password: form.elements.password.value,
        },
      });
      if (result.mfaRequired) {
        activeChallenge = result.challenge;
        form.hidden = true;
        mfaForm.hidden = false;
        mfaForm.elements.code.value = "";
        mfaForm.elements.code.focus();
        submit.disabled = false;
        return;
      }
      if (!ADMIN_ROLES.has(result.user?.role)) {
        await apiRequest("/v1/auth/logout", { method: "POST" });
        throw new Error("Esta conta não possui acesso administrativo.");
      }
      location.replace("/admin/dashboard");
    } catch (error) {
      showLoginError(error.message || "Não foi possível entrar.");
      submit.disabled = false;
    }
  });

  mfaForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = document.getElementById("admin-mfa-error");
    const submit = mfaForm.querySelector('[type="submit"]');
    if (error) error.textContent = "";
    const code = mfaForm.elements.code.value.replace(/\D/g, "");
    if (!activeChallenge || !/^\d{6}$/.test(code)) {
      if (error) error.textContent = "Digite os 6 dígitos do código.";
      return;
    }
    submit.disabled = true;
    try {
      const result = await apiRequest("/v1/auth/mfa/confirm", {
        method: "POST", body: { challenge: activeChallenge, code },
      });
      if (!ADMIN_ROLES.has(result.user?.role)) {
        await apiRequest("/v1/auth/logout", { method: "POST" }).catch(() => {});
        throw new Error("Esta conta não possui acesso administrativo.");
      }
      location.replace("/admin/dashboard");
    } catch (requestError) {
      if (error) error.textContent = requestError.message || "Não foi possível confirmar o código.";
      submit.disabled = false;
    }
  });

  document.getElementById("admin-mfa-restart")?.addEventListener("click", () => {
    activeChallenge = null;
    mfaForm.hidden = true;
    form.hidden = false;
    form.elements.password.value = "";
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
