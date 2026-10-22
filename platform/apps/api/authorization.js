import { AuthError } from "./auth-service.js";

export const ROLE_SCOPES = Object.freeze({
  customer: Object.freeze(["marketplace:use"]),
  courier: Object.freeze(["marketplace:use", "delivery:operate"]),
  moderator: Object.freeze(["marketplace:use", "admin:audit:read", "admin:moderate", "admin:users:read", "admin:institutions:read"]),
  admin: Object.freeze([
    "marketplace:use", "delivery:operate", "admin:audit:read", "admin:deliveries:validate",
    "admin:finance:read", "admin:institutions:read", "admin:institutions:write", "admin:moderate",
    "admin:operations:read", "admin:operations:write", "admin:privacy:review", "admin:roles:write",
    "admin:security:write", "admin:support:write", "admin:users:read", "admin:users:write",
    "admin:couriers:review",
  ]),
});

export function hasScope(user, scope) {
  const scopes = ROLE_SCOPES[user?.role] ?? [];
  return scopes.includes(scope);
}

export function requireScope(user, scope) {
  if (!user) throw new AuthError("unauthenticated", 401, "Sessão não autenticada.");
  if (!hasScope(user, scope)) {
    throw new AuthError("forbidden", 403, "Você não possui permissão para esta operação.");
  }
  return user;
}
