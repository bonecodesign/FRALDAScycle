const ROLES = new Set(["customer", "courier", "moderator", "admin"]);
const USER_STATUSES = new Set(["active", "suspended"]);

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export class AdminError extends Error {
  constructor(code, status, message) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function createAdminService(repository) {
  return Object.freeze({
    async users(params = {}) {
      const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
      const offset = Math.max(0, Number(params.offset) || 0);
      const role = params.role && ROLES.has(params.role) ? params.role : null;
      const status = params.status && USER_STATUSES.has(params.status) ? params.status : null;
      return repository.listUsers({
        query: String(params.query ?? "").trim().slice(0, 120) || null,
        role, status, limit, offset,
      });
    },

    async setUserStatus(actor, targetUserId, input) {
      const status = String(input?.status ?? "");
      const reason = String(input?.reason ?? "").trim();
      if (!USER_STATUSES.has(status)) throw new AdminError("invalid_status", 422, "Escolha ativo ou suspenso.");
      if (reason.length < 10 || reason.length > 500) throw new AdminError("invalid_reason", 422, "Registre uma justificativa com pelo menos 10 caracteres.");
      if (actor.id === targetUserId && status === "suspended") {
        throw new AdminError("self_suspension_forbidden", 409, "Um administrador não pode suspender a própria conta.");
      }
      const result = await repository.setUserStatus({
        actorUserId: actor.id, targetUserId, status, reason,
      });
      if (!result) throw new AdminError("user_not_found", 404, "Usuário não encontrado.");
      return result;
    },

    async auditEvents(params = {}) {
      const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
      const offset = Math.max(0, Number(params.offset) || 0);
      return repository.listAuditEvents({ limit, offset });
    },

    async auditCsv() {
      const items = await repository.listAuditEvents({ limit: 5_000, offset: 0 });
      const rows = [["Data", "Responsável", "Ação", "Entidade", "ID", "Metadados"]];
      for (const item of items) {
        rows.push([
          item.occurred_at, item.actor_name ?? "Sistema", item.action,
          item.entity_type, item.entity_id, JSON.stringify(item.metadata ?? {}),
        ]);
      }
      return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
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
