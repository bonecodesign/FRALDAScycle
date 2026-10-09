import { ServiceError } from "./service-error.js";
import { requireAdultDeclaration } from "./adult-declaration-service.js";
import { childAgeBand, CHILD_PROFILE_CONSENT_VERSION } from "../../packages/contracts/child-age-band.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (code, status, message) => new ServiceError(code, status, message);

function enabled(flag) {
  if (!flag) throw fail("child_profiles_disabled", 404, "Perfis infantis ainda não estão disponíveis.");
}

function exact(input, fields) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !fields.includes(key))) {
    throw fail("invalid_child_profile", 422, "Dados do perfil infantil inválidos.");
  }
}

function values(input, referenceDate) {
  const label = String(input.label ?? "").trim() || null;
  if (label && label.length > 50) throw fail("invalid_child_profile_label", 422, "Use um apelido com até 50 caracteres.");
  let ageBand;
  try { ageBand = childAgeBand(input.birthDate, referenceDate); }
  catch { throw fail("invalid_child_birth_date", 422, "Informe uma data de nascimento válida para uma pessoa menor de 18 anos."); }
  return { label, birthDate: input.birthDate, ageBand };
}

function publicProfile(row, referenceDate) {
  return {
    id: row.id, label: row.label, birthDate: String(row.birth_date).slice(0, 10),
    ageBand: childAgeBand(String(row.birth_date).slice(0, 10), referenceDate),
    consentVersion: row.consent_version, personalizationEnabled: Boolean(row.personalization_enabled),
    version: row.version, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function createChildProfileService(repository, { featureEnabled = false, now = () => new Date() } = {}) {
  return Object.freeze({
    async list(actor) {
      enabled(featureEnabled); requireAdultDeclaration(actor);
      return (await repository.list(actor.id)).map(row => publicProfile(row, now()));
    },
    async create(actor, input) {
      enabled(featureEnabled); requireAdultDeclaration(actor);
      exact(input, ["label", "birthDate", "consentConfirmed", "consentVersion", "personalizationEnabled"]);
      if (input.consentConfirmed !== true || input.consentVersion !== CHILD_PROFILE_CONSENT_VERSION || input.personalizationEnabled !== true) {
        throw fail("child_profile_consent_required", 422, "Confirme a personalização e a versão atual do consentimento.");
      }
      const value = values(input, now());
      return publicProfile(await repository.create({ accountId: actor.id, label: value.label, birthDate: value.birthDate, consentVersion: input.consentVersion }), now());
    },
    async update(actor, profileId, input) {
      enabled(featureEnabled); requireAdultDeclaration(actor);
      if (!UUID.test(profileId)) throw fail("child_profile_not_found", 404, "Perfil infantil não encontrado.");
      exact(input, ["label", "birthDate", "expectedVersion"]);
      if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw fail("child_profile_version_required", 422, "Consulte a versão atual do perfil.");
      const value = values(input, now());
      const row = await repository.update({ accountId: actor.id, profileId, expectedVersion: input.expectedVersion, label: value.label, birthDate: value.birthDate });
      if (!row) throw fail("child_profile_not_found", 404, "Perfil infantil não encontrado.");
      if (row.conflict) throw fail("child_profile_version_conflict", 409, "O perfil foi atualizado; consulte novamente.");
      return publicProfile(row, now());
    },
    async remove(actor, profileId, input) {
      enabled(featureEnabled); requireAdultDeclaration(actor);
      if (!UUID.test(profileId)) throw fail("child_profile_not_found", 404, "Perfil infantil não encontrado.");
      exact(input, ["confirmed", "expectedVersion"]);
      if (input.confirmed !== true || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw fail("child_profile_removal_confirmation_required", 422, "Confirme a remoção usando a versão atual.");
      const row = await repository.remove({ accountId: actor.id, profileId, expectedVersion: input.expectedVersion });
      if (!row) throw fail("child_profile_not_found", 404, "Perfil infantil não encontrado.");
      if (row.conflict) throw fail("child_profile_version_conflict", 409, "O perfil foi atualizado; consulte novamente.");
      return { id: row.id, removed: true, personalizationEnabled: false, version: row.version };
    },
    async personalizationSignals(actor) {
      enabled(featureEnabled); requireAdultDeclaration(actor);
      const rows = await repository.list(actor.id);
      return rows.filter(row => row.personalization_enabled).map(row => ({ profileId: row.id, ageBand: childAgeBand(String(row.birth_date).slice(0, 10), now()) }));
    },
  });
}
