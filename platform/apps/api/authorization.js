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
    "admin:couriers:review", "admin:catalog:write",
  ]),
});

export function hasScope(user, scope) {
  const scopes = ROLE_SCOPES[user?.role] ?? [];
  return scopes.includes(scope);
}

export function accessLevel(user) {
  if(!['admin','moderator'].includes(user?.role))return 0;
  const explicit=Number(user?.staffAccessLevel??user?.staff_access_level);
  if(Number.isInteger(explicit)&&explicit>=1&&explicit<=5)return explicit;
  if(user?.role==='admin')return 4;
  if(user?.role==='moderator')return 1;
  return 0;
}

export function requireAccessLevel(user,minimum) {
  if (!user) throw new AuthError("unauthenticated",401,"Sessão não autenticada.");
  if (!Number.isInteger(minimum)||minimum<1||minimum>5||accessLevel(user)<minimum) {
    throw new AuthError("insufficient_access_level",403,"Seu nível de acesso não permite esta operação.");
  }
  return user;
}

export function requireScope(user, scope) {
  if (!user) throw new AuthError("unauthenticated", 401, "Sessão não autenticada.");
  if (!hasScope(user, scope)) {
    throw new AuthError("forbidden", 403, "Você não possui permissão para esta operação.");
  }
  return user;
}
