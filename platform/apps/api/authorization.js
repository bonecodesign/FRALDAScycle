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

export const ADMIN_SCOPE_SECTORS=Object.freeze({
  'admin:moderate':Object.freeze(['moderation']),
  'admin:audit:read':Object.freeze(['security','legal_privacy']),
  'admin:users:read':Object.freeze(['support','operations']),
  'admin:users:write':Object.freeze(['support','operations']),
  'admin:operations:read':Object.freeze(['operations']),
  'admin:operations:write':Object.freeze(['operations']),
  'admin:finance:read':Object.freeze(['finance']),
  'admin:deliveries:validate':Object.freeze(['logistics']),
  'admin:security:write':Object.freeze(['security']),
  'admin:roles:write':Object.freeze(['operations']),
  'admin:institutions:read':Object.freeze(['institutions']),
  'admin:institutions:write':Object.freeze(['institutions']),
  'admin:catalog:write':Object.freeze(['moderation']),
  'admin:support:write':Object.freeze(['support']),
  'admin:couriers:review':Object.freeze(['logistics']),
  'admin:privacy:review':Object.freeze(['legal_privacy']),
});

export function staffSector(user){
  const value=user?.staffSector??user?.staff_sector??null;
  return typeof value==='string'&&value.trim()?value.trim():null;
}

export function hasSectorScope(user,scope){
  if(!hasScope(user,scope))return false;
  if(accessLevel(user)===5)return true;
  const sector=staffSector(user);
  // Compatibilidade temporária para sessões legadas criadas antes da migração setorial.
  // Convites novos exigem setor e a fila administrativa falha fechada sem ele.
  if(!sector)return true;
  return (ADMIN_SCOPE_SECTORS[scope]??[]).includes(sector);
}

export function requireSectorScope(user,scope){
  if(!user)throw new AuthError('unauthenticated',401,'Sessão não autenticada.');
  if(!hasSectorScope(user,scope))throw new AuthError('forbidden',403,'Seu setor não permite esta operação.');
  return user;
}

export function hasAdminSector(user,sectors){
  if(accessLevel(user)===5)return true;
  const sector=staffSector(user);
  if(!sector)return accessLevel(user)>0;
  return Array.isArray(sectors)&&sectors.includes(sector);
}

export function requireAdminSector(user,sectors,minimum=1){
  requireAccessLevel(user,minimum);
  if(!hasAdminSector(user,sectors))throw new AuthError('forbidden',403,'Seu setor não permite esta operação.');
  return user;
}
