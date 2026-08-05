import { apiRequest } from "/packages/contracts/api-client.js";

const ADMIN_ROLES = new Set(["admin", "moderator"]);

function showLoginError(message) {
  const error = document.getElementById("admin-login-error");
  if (error) error.textContent = message;
}

async function handleLogin() {
  const form = document.getElementById("admin-login-form");
  if (!form) return;

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
}

async function requireAdmin() {
  if (location.pathname === "/admin/login") return handleLogin();
  document.documentElement.dataset.adminAuth = "pending";
  try {
    const result = await apiRequest("/v1/auth/session");
    if (!ADMIN_ROLES.has(result.user?.role)) throw new Error("forbidden");
    document.documentElement.dataset.adminAuth = "ready";
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
