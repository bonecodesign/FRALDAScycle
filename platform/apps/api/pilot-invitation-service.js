import { createHash, randomBytes } from "node:crypto";
import { pilotInvitationIssuance } from "../../packages/contracts/pilot-invitation.js";
import { requireScope } from "./authorization.js";
import { ServiceError } from "./service-error.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFERENCE = /^[a-zA-Z0-9/_:.-]{16,128}$/;
const tokenHash = token => createHash("sha256").update(token).digest();

export function createPilotInvitationService(repository, { clock = Date.now, tokenFactory = () => randomBytes(32).toString("base64url") } = {}) {
  return Object.freeze({
    async issue(actor, input) {
      requireScope(actor, "admin:users:write");
      const now = clock();
      let invitation;
      try { invitation = pilotInvitationIssuance(input, { now }); }
      catch { throw new ServiceError("invalid_pilot_invitation", 422, "Informe e-mail, finalidade e vencimento futuro válidos."); }
      const requestReference = String(input?.requestReference ?? "").trim();
      if (!REFERENCE.test(requestReference)) {
        throw new ServiceError("invalid_pilot_invitation_reference", 422, "Informe uma referência idempotente válida.");
      }
      const token = tokenFactory();
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("pilot invitation token factory returned an invalid token");
      const result = await repository.issue({
        actorId: actor.id, ...invitation, requestReference,
        tokenHash: tokenHash(token), now: new Date(now).toISOString(),
      });
      return { ...result, token: result.reused ? null : token, delivered: false };
    },

    async list(actor, { limit = "50" } = {}) {
      requireScope(actor, "admin:users:read");
      if (!/^[1-9][0-9]?$/.test(String(limit)) || Number(limit) > 50) {
        throw new ServiceError("invalid_pilot_invitation_limit", 422, "Informe um limite entre 1 e 50.");
      }
      return repository.list({ limit: Number(limit) });
    },

    async revoke(actor, invitationId, input) {
      requireScope(actor, "admin:users:write");
      const reason = String(input?.reason ?? "").trim();
      if (!UUID.test(String(invitationId ?? "")) || reason.length < 10 || reason.length > 240) {
        throw new ServiceError("invalid_pilot_invitation_revocation", 422, "Informe convite e justificativa válidos.");
      }
      return repository.revoke({ actorId: actor.id, invitationId, reason, now: new Date(clock()).toISOString() });
    },
  });
}
