import { AuthError } from "./auth-service.js";

export const ROLE_SCOPES = Object.freeze({
  customer: Object.freeze(["marketplace:use"]),
  courier: Object.freeze(["marketplace:use", "delivery:operate"]),
  moderator: Object.freeze(["marketplace:use", "admin:audit:read", "admin:moderate"]),
  admin: Object.freeze(["*"]),
});

export function hasScope(user, scope) {
  const scopes = ROLE_SCOPES[user?.role] ?? [];
  return scopes.includes("*") || scopes.includes(scope);
}

export function requireScope(user, scope) {
  if (!user) throw new AuthError("unauthenticated", 401, "Sessão não autenticada.");
  if (!hasScope(user, scope)) {
    throw new AuthError("forbidden", 403, "Você não possui permissão para esta operação.");
  }
  return user;
}
