import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "./security.js";
const ROLES = new Set(["customer", "courier", "moderator", "admin"]);
const USER_STATUSES = new Set(["active", "suspended"]);
const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

function invitationHash(token) { return createHash("sha256").update(token).digest(); }

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
    async createInvitation(actor, input) {
      const email = String(input?.email ?? "").trim().toLocaleLowerCase("pt-BR");
      const displayName = String(input?.displayName ?? "").trim();
      const role = String(input?.role ?? "");
      if (!EMAIL_PATTERN.test(email)) throw new AdminError("invalid_email", 422, "Informe um e-mail válido.");
      if (displayName.length < 2 || displayName.length > 100) throw new AdminError("invalid_display_name", 422, "Informe o nome da pessoa convidada.");
      if (!ROLES.has(role)) throw new AdminError("invalid_role", 422, "Escolha um papel válido.");
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
      const invitation = await repository.createInvitation({
        actorUserId: actor.id, email, displayName, role,
        token, tokenHash: invitationHash(token), expiresAt,
      });
      if (!invitation) {
        throw new AdminError("account_exists", 409, "Já existe uma conta com este e-mail.");
      }
      return { invitation, queued: true };
    },

    async acceptInvitation(input) {
      const token = String(input?.token ?? "");
      const password = String(input?.password ?? "");
      if (token.length < 32) throw new AdminError("invalid_invitation", 422, "Convite inválido ou expirado.");
      if (password.length < 12) throw new AdminError("weak_password", 422, "A senha deve ter pelo menos 12 caracteres.");
      try {
        const user = await repository.acceptInvitation({
          tokenHash: invitationHash(token), passwordHash: await hashPassword(password),
        });
        if (!user) throw new AdminError("invalid_invitation", 422, "Convite inválido ou expirado.");
        return { user: {
          id: user.id, email: user.email, phone: user.phone ?? null,
          displayName: user.display_name, role: user.role, emailVerified: Boolean(user.email_verified_at),
        } };
      } catch (error) {
        if (error?.code === "23505") throw new AdminError("account_exists", 409, "Já existe uma conta com este e-mail.");
        throw error;
      }
    },

    async sessions(actor) {
      if (!actor.sessionId) throw new AdminError("session_context_missing", 409, "Não foi possível identificar a sessão atual.");
      return repository.listUserSessions({ userId: actor.id, currentSessionId: actor.sessionId });
    },

    async revokeOtherSessions(actor) {
      if (!actor.sessionId) throw new AdminError("session_context_missing", 409, "Não foi possível identificar a sessão atual.");
      const revokedCount = await repository.revokeOtherSessions({
        actorUserId: actor.id, currentSessionId: actor.sessionId,
      });
      return { revokedCount };
    },

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
