import { createHash } from "node:crypto";
import { validateResponsibleProfileChange } from "../../packages/contracts/responsible-profile-change.js";
import { createSessionToken, createVerificationCode, verifyPassword } from "./security.js";
import { ServiceError } from "./service-error.js";

const TTL_MS = 15 * 60 * 1000;
const digest = value => createHash("sha256").update(value).digest();
const error = (code, status, message) => new ServiceError(code, status, message);

export function createResponsibleProfileChangeService(repository) {
  return Object.freeze({
    async request(actor, input) {
      if (!input || typeof input !== "object" || Array.isArray(input)
          || Object.keys(input).some(key => !["password", "change"].includes(key))) {
        throw error("invalid_responsible_profile_change", 422, "A alteração solicitada é inválida.");
      }
      const account = await repository.account(actor.id);
      if (!account?.responsible_registration_completed_at) {
        throw error("responsible_registration_required", 409, "Conclua primeiro o cadastro do responsável.");
      }
      if (!account.email || !account.email_verified_at) {
        throw error("verified_email_required", 409, "É necessário um e-mail verificado.");
      }
      if (!await verifyPassword(String(input.password ?? ""), account.password_hash)) {
        throw error("invalid_credentials", 401, "Senha inválida.");
      }
      const change = validateResponsibleProfileChange(input.change);
      const challenge = createSessionToken();
      const code = createVerificationCode();
      const expiresAt = new Date(Date.now() + TTL_MS);
      await repository.issue({
        userId: actor.id, code, expiresAt,
        challengeHash: digest(`responsible-change:${challenge}`),
        tokenHash: digest(`responsible-change:${challenge}.${code}`),
        changeHash: digest(JSON.stringify(change)),
      });
      return Object.freeze({ accepted: true, challenge, expiresAt });
    },

    async confirm(actor, input) {
      if (!input || typeof input !== "object" || Array.isArray(input)
          || Object.keys(input).some(key => !["challenge", "code", "change"].includes(key))) {
        throw error("invalid_responsible_change_code", 422, "Código inválido ou expirado.");
      }
      const challenge = String(input.challenge ?? "");
      const code = String(input.code ?? "");
      if (!/^[A-Za-z0-9_-]{43}$/.test(challenge) || !/^\d{6}$/.test(code)) {
        throw error("invalid_responsible_change_code", 422, "Código inválido ou expirado.");
      }
      const change = validateResponsibleProfileChange(input.change);
      const result = await repository.confirm({
        userId: actor.id,
        challengeHash: digest(`responsible-change:${challenge}`),
        tokenHash: digest(`responsible-change:${challenge}.${code}`),
        changeHash: digest(JSON.stringify(change)),
        change,
      });
      if (result?.limited) throw error("too_many_attempts", 429, "Muitas tentativas. Solicite um novo código.");
      if (!result) throw error("invalid_responsible_change_code", 422, "Código inválido ou expirado.");
      return Object.freeze({ success: true });
    },
  });
}
