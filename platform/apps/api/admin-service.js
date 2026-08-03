const ROLES = new Set(["customer", "courier", "moderator", "admin"]);

export class AdminError extends Error {
  constructor(code, status, message) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function createAdminService(repository) {
  return Object.freeze({
    async auditEvents(params = {}) {
      const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
      const offset = Math.max(0, Number(params.offset) || 0);
      return repository.listAuditEvents({ limit, offset });
    },

    async changeUserRole(actor, targetUserId, input) {
      const role = String(input?.role ?? "");
      if (!ROLES.has(role)) throw new AdminError("invalid_role", 422, "Escolha um papel válido.");
      if (actor.id === targetUserId && role !== "admin") {
        throw new AdminError("self_demotion_forbidden", 409, "Um administrador não pode remover o próprio acesso.");
      }
      const result = await repository.changeUserRole({
        actorUserId: actor.id, targetUserId, role,
      });
      if (!result) throw new AdminError("user_not_found", 404, "Usuário não encontrado.");
      return result;
    },
  });
}
