import { ServiceError } from "./service-error.js";
import { requireAdultDeclaration } from "./adult-declaration-service.js";
import { childAgeBand, childAgeDisplay, CHILD_PROFILE_CONSENT_VERSION, CHILD_PROFILE_EMOJIS } from "../../packages/contracts/child-age-band.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (code, status, message) => new ServiceError(code, status, message);

function enabled(flag) {
  if (!flag) throw fail("child_profiles_disabled", 404, "Perfis infantis ainda não estão disponíveis.");
}

function requireFamilyAccount(actor) {
  requireAdultDeclaration(actor);
  if (actor.role !== "customer") {
    throw fail("family_profile_not_available", 403, "Use uma conta familiar para gerenciar perfis infantis.");
  }
  return actor;
}

function exact(input, fields) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !fields.includes(key))) {
    throw fail("invalid_child_profile", 422, "Dados do perfil infantil inválidos.");
  }
}

function values(input, referenceDate) {
  let ageBand;
  try { ageBand = childAgeBand(input.birthDate, referenceDate); }
  catch { throw fail("invalid_child_birth_date", 422, "Informe uma data de nascimento válida para uma criança de até 12 anos."); }
  if (!CHILD_PROFILE_EMOJIS.includes(input.emoji)) throw fail("invalid_child_profile_emoji", 422, "Escolha um emoji disponível para o perfil.");
  return { birthDate: input.birthDate, emoji: input.emoji, ageBand };
}

function storedBirthDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function publicProfile(row, referenceDate) {
  const birthDate = storedBirthDate(row.birth_date);
  return {
    id: row.id, birthDate, emoji: row.emoji,
    ageBand: childAgeBand(birthDate, referenceDate),
    ageDisplay: childAgeDisplay(birthDate, referenceDate),
    consentVersion: row.consent_version, personalizationEnabled: Boolean(row.personalization_enabled),
    version: row.version, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function createChildProfileService(repository, { featureEnabled = false, now = () => new Date() } = {}) {
  return Object.freeze({
    async notices(actor) {
      enabled(featureEnabled); requireFamilyAccount(actor);
      return repository.notices(actor.id);
    },

    async requireForNewOperation(actor) {
      if (!featureEnabled || actor?.role !== "customer") return actor;
      requireFamilyAccount(actor);
      if (!(await repository.hasActive(actor.id))) {
        throw fail("child_profile_required", 403, "Cadastre ao menos um perfil familiar antes de iniciar uma nova operação.");
      }
      return actor;
    },
    async list(actor) {
      enabled(featureEnabled); requireFamilyAccount(actor);
      return (await repository.list(actor.id)).map(row => publicProfile(row, now()));
    },
    async create(actor, input) {
      enabled(featureEnabled); requireFamilyAccount(actor);
      exact(input, ["birthDate", "emoji", "consentConfirmed", "consentVersion", "personalizationEnabled"]);
      if (input.consentConfirmed !== true || input.consentVersion !== CHILD_PROFILE_CONSENT_VERSION || input.personalizationEnabled !== true) {
        throw fail("child_profile_consent_required", 422, "Confirme a personalização e a versão atual do consentimento.");
      }
      const value = values(input, now());
      const row = await repository.create({ accountId: actor.id, birthDate: value.birthDate, emoji: value.emoji, consentVersion: input.consentVersion });
      if (row.limit) throw fail("child_profile_limit_reached", 409, "A conta já possui o limite de cinco perfis infantis.");
      if (row.emojiConflict) throw fail("child_profile_emoji_in_use", 409, "Esse emoji já está em uso nesta conta.");
      return publicProfile(row, now());
    },
    async update(actor, profileId, input) {
      enabled(featureEnabled); requireFamilyAccount(actor);
      if (!UUID.test(profileId)) throw fail("child_profile_not_found", 404, "Perfil infantil não encontrado.");
      exact(input, ["birthDate", "emoji", "expectedVersion"]);
      if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw fail("child_profile_version_required", 422, "Consulte a versão atual do perfil.");
      const value = values(input, now());
      const row = await repository.update({ accountId: actor.id, profileId, expectedVersion: input.expectedVersion, birthDate: value.birthDate, emoji: value.emoji });
      if (!row) throw fail("child_profile_not_found", 404, "Perfil infantil não encontrado.");
      if (row.conflict) throw fail("child_profile_version_conflict", 409, "O perfil foi atualizado; consulte novamente.");
      if (row.emojiConflict) throw fail("child_profile_emoji_in_use", 409, "Esse emoji já está em uso nesta conta.");
      return publicProfile(row, now());
    },
    async remove(actor, profileId, input) {
      enabled(featureEnabled); requireFamilyAccount(actor);
      if (!UUID.test(profileId)) throw fail("child_profile_not_found", 404, "Perfil infantil não encontrado.");
      exact(input, ["confirmed", "expectedVersion"]);
      if (input.confirmed !== true || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw fail("child_profile_removal_confirmation_required", 422, "Confirme a remoção usando a versão atual.");
      const row = await repository.remove({ accountId: actor.id, profileId, expectedVersion: input.expectedVersion });
      if (!row) throw fail("child_profile_not_found", 404, "Perfil infantil não encontrado.");
      if (row.conflict) throw fail("child_profile_version_conflict", 409, "O perfil foi atualizado; consulte novamente.");
      if (row.lastProfile) throw fail("last_child_profile_required", 409, "Adicione outro perfil antes de remover o último perfil infantil.");
      return { id: row.id, removed: true, personalizationEnabled: false, version: row.version };
    },
    async personalizationSignals(actor) {
      enabled(featureEnabled); requireFamilyAccount(actor);
      const rows = await repository.list(actor.id);
      const bands = new Set(rows.filter(row => row.personalization_enabled)
        .map(row => childAgeBand(storedBirthDate(row.birth_date), now())));
      return [...bands].sort().map(ageBand => ({ ageBand }));
    },
  });
}
