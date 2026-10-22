import { hasScope, requireScope } from "./authorization.js";
import { ServiceError } from "./service-error.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PURPOSES = new Set(["verification", "support_review", "legal_audit", "deletion"]);
const REVIEW_KINDS = new Set(["initial", "renewal", "correction"]);
const REFERENCE = /^[a-zA-Z0-9/_:.-]{16,256}$/;

export function createCourierEligibilityService(repository, {
  retentionPolicy = null, clock = Date.now, featureEnabled = true,
} = {}) {
  const enabled = () => {
    if (!featureEnabled) throw new ServiceError("courier_eligibility_disabled", 404, "Elegibilidade de entregadores ainda não está disponível.");
  };
  return Object.freeze({
    async scheduleMaintenance(actor) {
      enabled(); requireScope(actor, "admin:operations:write");
      return repository.scheduleMaintenanceTasks({ actorId: actor.id, now: new Date(clock()).toISOString() });
    },

    async reviewQueue(actor, { limit = "50" } = {}) {
      enabled(); requireScope(actor, "admin:couriers:review");
      if (!/^[1-9][0-9]?$/.test(String(limit)) || Number(limit) > 50) {
        throw new ServiceError("invalid_queue_limit", 422, "Informe um limite entre 1 e 50.");
      }
      return repository.pendingReviewQueue({ limit: Number(limit) });
    },

    async supportQueue(actor, { limit = "50" } = {}) {
      enabled(); requireScope(actor, "admin:support:write");
      if (!/^[1-9][0-9]?$/.test(String(limit)) || Number(limit) > 50) {
        throw new ServiceError("invalid_queue_limit", 422, "Informe um limite entre 1 e 50.");
      }
      return repository.pendingSupportQueue({ limit: Number(limit) });
    },

    async status(actor, courierId = actor?.id) {
      enabled();
      if (!UUID.test(String(courierId ?? ""))) throw new ServiceError("invalid_courier", 422, "Entregador inválido.");
      const own = actor?.role === "courier" && actor.id === courierId;
      if (!own && !hasScope(actor, "admin:users:read")) {
        throw new ServiceError("forbidden", 403, "Acesso não autorizado.");
      }
      const result = await repository.status(courierId);
      if (!result) throw new ServiceError("courier_profile_not_found", 404, "Perfil de entregador não encontrado.");
      return result;
    },

    async restrictedDocument(actor, documentId, input) {
      enabled();
      requireScope(actor, "admin:couriers:review");
      const purpose = String(input?.purpose ?? "");
      const requestReference = String(input?.requestReference ?? "").trim();
      if (!UUID.test(String(documentId ?? "")) || !PURPOSES.has(purpose) ||
          requestReference.length < 16 || requestReference.length > 128) {
        throw new ServiceError("invalid_clearance_access", 422, "Informe documento, finalidade e referência válidos.");
      }
      return repository.restrictedDocument({
        actorId: actor.id, documentId, purpose, requestReference,
      });
    },

    async submitClearance(actor, input) {
      enabled();
      if (actor?.role !== "courier") throw new ServiceError("forbidden", 403, "Use a conta do entregador.");
      const reviewKind = String(input?.reviewKind ?? "");
      const submittedAt = String(input?.submittedAt ?? "");
      const values = [input?.encryptedObjectReference, input?.encryptionKeyReference,
        input?.submissionReference].map(value => String(value ?? "").trim());
      if (!REVIEW_KINDS.has(reviewKind) || values.some(value => !REFERENCE.test(value)) ||
          !Number.isFinite(Date.parse(submittedAt))) {
        throw new ServiceError("invalid_clearance_submission", 422, "Envio do atestado inválido.");
      }
      if (retentionPolicy?.status !== "approved" || !REFERENCE.test(String(retentionPolicy?.version ?? "")) ||
          !UUID.test(String(retentionPolicy?.legalApproverId ?? ""))) {
        throw new ServiceError("clearance_retention_policy_not_approved", 503, "Política de retenção ainda não aprovada.");
      }
      return repository.submitClearance({
        courierId: actor.id, reviewKind,
        encryptedObjectReference: values[0], encryptionKeyReference: values[1],
        submissionReference: values[2],
        retentionPolicyVersion: retentionPolicy.version,
        retentionLegalApproverId: retentionPolicy.legalApproverId,
        submittedAt,
      });
    },

    async decideReview(actor, reviewId, input) {
      enabled();
      requireScope(actor, "admin:couriers:review");
      const decision = String(input?.decision ?? "");
      const auditReference = String(input?.auditReference ?? "").trim();
      if (!UUID.test(String(reviewId ?? "")) || !["approved", "rejected"].includes(decision) ||
          !REFERENCE.test(auditReference)) {
        throw new ServiceError("invalid_clearance_decision", 422, "Decisão da revisão inválida.");
      }
      const approval = [input?.issuerVerificationReference, input?.issuedAt, input?.expiresAt];
      if (decision === "approved" && (!REFERENCE.test(String(approval[0] ?? "")) ||
          !Number.isFinite(Date.parse(approval[1])) || !Number.isFinite(Date.parse(approval[2])) ||
          Date.parse(approval[2]) <= Date.parse(approval[1]))) {
        throw new ServiceError("invalid_clearance_validity", 422, "Confirme referência, emissão e validade oficiais.");
      }
      return repository.decideClearanceReview({
        reviewerId: actor.id, reviewId, decision,
        decidedAt: new Date(clock()).toISOString(), auditReference,
        issuerVerificationReference: decision === "approved" ? String(approval[0]) : null,
        issuedAt: decision === "approved" ? String(approval[1]) : null,
        expiresAt: decision === "approved" ? String(approval[2]) : null,
      });
    },

    async requestSupportRelease(actor, input) {
      enabled();
      if (actor?.role !== "courier") throw new ServiceError("forbidden", 403, "Use a conta do entregador.");
      const requestReference = String(input?.requestReference ?? "").trim();
      if (!REFERENCE.test(requestReference)) {
        throw new ServiceError("invalid_support_release_request", 422, "Referência da solicitação inválida.");
      }
      return repository.openSupportReleaseRequest({
        courierId: actor.id, requestReference, openedAt: new Date(clock()).toISOString(),
      });
    },

    async releaseSuspension(actor, suspensionId, input) {
      enabled();
      requireScope(actor, "admin:support:write");
      const auditReference = String(input?.auditReference ?? "").trim();
      if (!UUID.test(String(suspensionId ?? "")) || input?.confirmed !== true ||
          !REFERENCE.test(auditReference)) {
        throw new ServiceError("invalid_support_release", 422, "Confirme a liberação e informe a referência de auditoria.");
      }
      return repository.releaseSuspension({
        reviewerId: actor.id, suspensionId, auditReference,
        decidedAt: new Date(clock()).toISOString(),
      });
    },

    async closeExpiredSupportRequests(actor) {
      enabled();
      requireScope(actor, "admin:support:write");
      return repository.closeExpiredSupportRequests({
        actorId: actor.id, closedAt: new Date(clock()).toISOString(),
      });
    },
  });
}
