import { institutionTransitionAllowed } from "../../packages/contracts/institution-status.js";
import { pagination } from "./pagination.js";
import { ServiceError } from "./service-error.js";
import { pilotBhLocation, pilotBhPostalCode } from "./pilot-bh.js";
export class InstitutionError extends ServiceError {
  constructor(code, status, message) {
    super(code, status, message);
  }
}

const STATUSES = new Set(["pending", "under_review", "active", "suspended", "documents_expired", "rejected", "closed"]);


const text = (value) => String(value ?? "").trim();

export function createInstitutionService(repository, { pilotBh = null } = {}) {
  return Object.freeze({
    async active(params = {}) {
      return repository.listActive({
        state: pilotBh?.enabled ? "MG" : text(params.state).toUpperCase() || null,
        city: pilotBh?.enabled ? "Belo Horizonte" : text(params.city).slice(0, 100) || null,
        ...pagination(params),
      });
    },

    async applications(params = {}) {
      const status = text(params.status);
      return repository.listAdmin({
        status: status && STATUSES.has(status) ? status : null,
        ...pagination(params),
      });
    },

    async submit(userId, input) {
      const data = {
        submittedByUserId: userId,
        legalName: text(input?.legalName), publicName: text(input?.publicName),
        taxId: text(input?.taxId).replace(/\D/g, ""),
        representativeName: text(input?.representativeName),
        representativeEmail: text(input?.representativeEmail).toLowerCase(),
        city: text(input?.city), state: text(input?.state).toUpperCase(),
        addressLine: text(input?.addressLine), postalCode: text(input?.postalCode).replace(/\D/g, ""),
        openPackagesAccepted: Boolean(input?.openPackagesAccepted),
        documentKeys: Array.isArray(input?.documentKeys) ? input.documentKeys.map(text).filter(Boolean).slice(0, 20) : [],
      };
      if (data.legalName.length < 3 || data.publicName.length < 3) throw new InstitutionError("invalid_institution_name", 422, "Informe a razão social e o nome público.");
      if (!/^\d{14}$/.test(data.taxId)) throw new InstitutionError("invalid_tax_id", 422, "Informe um CNPJ com 14 dígitos.");
      if (data.representativeName.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.representativeEmail)) throw new InstitutionError("invalid_representative", 422, "Informe o representante e um e-mail válido.");
      if (!data.city || !/^[A-Z]{2}$/.test(data.state) || data.addressLine.length < 5 || data.postalCode.length !== 8) throw new InstitutionError("invalid_address", 422, "Informe o endereço institucional completo.");
      if (!pilotBhLocation(pilotBh, data.city, data.state) || !pilotBhPostalCode(pilotBh, data.postalCode)) throw new InstitutionError("pilot_outside_bh", 403, "O piloto aceita somente instituições de Belo Horizonte, MG, com CEP da capital.");
      if (data.documentKeys.length === 0 || data.documentKeys.some((key) => !/^[a-zA-Z0-9/_-]{8,512}$/.test(key))) throw new InstitutionError("institution_documents_required", 422, "Envie ao menos um documento institucional válido.");
      try {
        return await repository.createApplication(data);
      } catch (error) {
        if (error?.code === "23505") throw new InstitutionError("institution_exists", 409, "Já existe uma instituição cadastrada com este CNPJ.");
        throw error;
      }
    },

    async changeStatus(actorId, institutionId, input) {
      const status = text(input?.status);
      const reason = text(input?.reason);
      if (!STATUSES.has(status) || status === "pending") throw new InstitutionError("invalid_institution_status", 422, "Escolha um estado institucional válido.");
      if (reason.length < 10 || reason.length > 500) throw new InstitutionError("invalid_review_reason", 422, "Registre uma justificativa com pelo menos 10 caracteres.");
      const current = await repository.detailAdmin(institutionId);
      if (!current) throw new InstitutionError("institution_not_found", 404, "Instituição não encontrada.");
      if (!institutionTransitionAllowed(current.status,status)) throw new InstitutionError("invalid_status_transition", 409, "Esta mudança de estado institucional não é permitida.");
      if (status === "active" && (!pilotBhLocation(pilotBh, current.city, current.state) || !pilotBhPostalCode(pilotBh, current.postal_code ?? current.postalCode))) throw new InstitutionError("pilot_outside_bh", 403, "O piloto aceita somente instituições de Belo Horizonte, MG, com CEP da capital.");
      const verification = input?.verification;
      if (pilotBh?.enabled && status === "active" && (
        !verification || verification.documentsChecked !== true ||
        verification.representativeChecked !== true || verification.capacityChecked !== true ||
        !Array.isArray(current.document_keys) || current.document_keys.length === 0
      )) throw new InstitutionError("institution_verification_required", 422, "Confirme documentos, representante e capacidade antes de ativar a instituição.");
      return repository.changeStatus({ actorUserId: actorId, institutionId, status, reason, expectedStatus:current.status,
        verification: pilotBh?.enabled && status === "active" ? { documentsChecked: true, representativeChecked: true, capacityChecked: true } : null });
    },
  });
}


