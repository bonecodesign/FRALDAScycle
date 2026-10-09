import { pagination } from "./pagination.js";
import { ServiceError } from "./service-error.js";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hashPassword } from "./security.js";
const ROLES = new Set(["customer", "courier", "moderator", "admin"]);
const USER_STATUSES = new Set(["active", "suspended"]);
const LISTING_STATUSES = new Set(["draft", "review", "published", "completed", "paused", "removed", "unavailable"]);
const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invitationHash(token) { return createHash("sha256").update(token).digest(); }

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export class AdminError extends ServiceError {
  constructor(code, status, message) {
    super(code, status, message);
  }
}

function reviewFingerprint(detail) {
  return createHash("sha256").update(JSON.stringify({ listing: detail.listing,
    media: detail.media.map(item => item.storage_key) })).digest("hex");
}

export function createAdminService(repository, mediaProvider = null, { reviewSecret = null } = {}) {
  function signature(payload) {
    if (!reviewSecret || reviewSecret.length < 32) throw new AdminError("review_context_unavailable", 503, "A revisão protegida está indisponível.");
    return createHmac("sha256", reviewSecret).update(payload).digest();
  }
  function validateReviewContext(actor, detail, token) {
    try {
      const parts = typeof token === "string" && token.length <= 2_048 ? token.split(".") : [];
      if (parts.length !== 2) throw new Error();
      const expected = signature(parts[0]);
      const supplied = Buffer.from(parts[1], "base64url");
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error();
      const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
      if (payload.actorId !== actor.id || payload.sessionId !== (actor.sessionId ?? null) ||
          payload.fingerprint !== reviewFingerprint(detail) || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) throw new Error();
    } catch (error) {
      if (error?.code === "review_context_unavailable") throw error;
      throw new AdminError("listing_review_context_expired", 409, "Abra novamente a revisão e confira todas as fotos antes de aprovar.");
    }
  }
  return Object.freeze({
    issueReviewContext(actor, detail, media) {
      const expiresAt = Math.min(Date.now() + 300_000, ...media.map(item => Date.parse(item.expiresAt)));
      if (!media.length || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
      const payload = Buffer.from(JSON.stringify({ actorId: actor.id, sessionId: actor.sessionId ?? null,
        fingerprint: reviewFingerprint(detail), expiresAt })).toString("base64url");
      return `${payload}.${signature(payload).toString("base64url")}`;
    },
    async webhookSnapshot(actor, params = {}) {
      const { limit, offset } = pagination(params, { defaultLimit: 50, maxLimit: 100 });
      return repository.webhookSnapshot({ actorUserId: actor.id, limit, offset });
    },
    async accessSnapshot(actor) {
      return repository.accessSnapshot({ actorUserId: actor.id });
    },
    async catalogSnapshot(actor, params = {}) {
      const { limit, offset } = pagination(params, { defaultLimit: 50, maxLimit: 100 });
      return repository.catalogSnapshot({
        actorUserId: actor.id,
        query: String(params.query ?? "").trim().slice(0, 120) || null,
        status: LISTING_STATUSES.has(params.status) ? params.status : null,
        limit, offset,
      });
    },
    async listingReviewDetail(actor, listingId) {
      if (!UUID_PATTERN.test(listingId)) throw new AdminError("listing_not_found", 404, "Anúncio não encontrado.");
      const detail = await repository.listingReviewDetail({ actorUserId: actor.id, listingId });
      if (!detail) throw new AdminError("listing_not_found", 404, "Anúncio não encontrado.");
      return detail;
    },
    async reviewListing(actor, listingId, input) {
      if (!UUID_PATTERN.test(listingId)) throw new AdminError("listing_not_found", 404, "Anúncio não encontrado.");
      const outcome = String(input?.outcome ?? "");
      const reason = String(input?.reason ?? "").trim();
      if (input?.confirmed !== true || !["published", "removed"].includes(outcome) || reason.length < 10 || reason.length > 2_000) {
        throw new AdminError("invalid_listing_review", 422, "Confirme a decisão e registre uma justificativa de 10 a 2000 caracteres.");
      }
      let expectedUpdatedAt;
      if (outcome === "published") {
        if (!mediaProvider?.verifyListingMedia) throw new AdminError("media_verification_unavailable", 503, "A confirmação das fotos está indisponível.");
        const detail = await repository.listingReviewDetail({ actorUserId: actor.id, listingId });
        if (!detail) throw new AdminError("listing_not_found", 404, "Anúncio não encontrado.");
        if (detail.listing.seller_id === actor.id) throw new AdminError("independent_listing_review_required", 403, "O anúncio deve ser revisado por outra pessoa.");
        if (detail.listing.status !== "review") throw new AdminError("listing_review_conflict", 409, "O anúncio não está mais aguardando revisão.");
        validateReviewContext(actor, detail, input.reviewContext);
        expectedUpdatedAt = detail.listing.updated_at;
        await mediaProvider.verifyListingMedia(detail.listing.seller_id, detail.media.map(item => item.storage_key));
      }
      const listing = await repository.reviewListing({ actorUserId: actor.id, listingId, outcome, reason, expectedUpdatedAt });
      if (!listing) throw new AdminError("listing_not_found", 404, "Anúncio não encontrado.");
      return listing;
    },
    async overviewSnapshot(actor, params = {}) {
      const { limit } = pagination(params, { defaultLimit: 20, maxLimit: 50 });
      return repository.overviewSnapshot({ actorUserId: actor.id, limit });
    },
    async financeSnapshot(actor, params = {}) {
      const { limit, offset } = pagination(params, { defaultLimit: 50, maxLimit: 100 });
      return repository.financeSnapshot({ actorUserId: actor.id, limit, offset });
    },
    async logisticsSnapshot(actor, params = {}) {
      const { limit, offset } = pagination(params, { defaultLimit: 50, maxLimit: 100 });
      return repository.logisticsSnapshot({ actorUserId: actor.id, limit, offset });
    },
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
      const { limit, offset } = pagination(params);
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
      const { limit, offset } = pagination(params);
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

