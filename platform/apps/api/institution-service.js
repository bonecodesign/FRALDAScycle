export class InstitutionError extends Error {
  constructor(code, status, message) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const STATUSES = new Set(["pending", "under_review", "active", "suspended", "documents_expired", "rejected", "closed"]);
const TRANSITIONS = Object.freeze({
  pending: new Set(["under_review", "rejected"]),
  under_review: new Set(["active", "rejected"]),
  active: new Set(["suspended", "documents_expired", "closed"]),
  suspended: new Set(["active", "closed"]),
  documents_expired: new Set(["under_review", "active", "closed"]),
  rejected: new Set(["under_review", "closed"]),
  closed: new Set(),
});

const text = (value) => String(value ?? "").trim();

export function createInstitutionService(repository) {
  return Object.freeze({
    async active(params = {}) {
      return repository.listActive({
        state: text(params.state).toUpperCase() || null,
        city: text(params.city).slice(0, 100) || null,
        limit: Math.min(100, Math.max(1, Number(params.limit) || 50)),
        offset: Math.max(0, Number(params.offset) || 0),
      });
    },

    async applications(params = {}) {
      const status = text(params.status);
      return repository.listAdmin({
        status: status && STATUSES.has(status) ? status : null,
        limit: Math.min(100, Math.max(1, Number(params.limit) || 50)),
        offset: Math.max(0, Number(params.offset) || 0),
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
      if (!TRANSITIONS[current.status]?.has(status)) throw new InstitutionError("invalid_status_transition", 409, "Esta mudança de estado institucional não é permitida.");
      return repository.changeStatus({ actorUserId: actorId, institutionId, status, reason });
    },
  });
}
