import { normalizeBrazilianPostalCode, requireVerifiedPostalCode } from "./postal-code-verification.js";

export const RESPONSIBLE_TRUTH_DECLARATION_VERSION = "FC-RESPONSIBLE-1";

const ALLOWED_FIELDS = new Set(["fullName", "cpf", "birthDate", "address", "postalCodeEvidence", "truthDeclaration", "terms"]);
const ADDRESS_FIELDS = new Set(["id", "version", "postalCode", "street", "number", "complement", "noComplement", "district", "city", "state"]);

function registrationError(code, message) {
  return Object.assign(new TypeError(message), { code, status: 422 });
}

function assertExactFields(value, allowed, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).some(key => !allowed.has(key))) {
    throw registrationError(code, "Os dados informados não correspondem ao cadastro esperado.");
  }
}

function normalizedText(value, { min, max, code, label }) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) {
    throw registrationError(code, `Informe ${label}.`);
  }
  return text;
}

export function normalizeCpf(value) {
  const cpf = String(value ?? "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    throw registrationError("invalid_cpf", "Informe um CPF válido.");
  }
  for (let length = 9; length <= 10; length += 1) {
    const sum = cpf.slice(0, length).split("").reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const expected = (sum * 10) % 11 % 10;
    if (expected !== Number(cpf[length])) throw registrationError("invalid_cpf", "Informe um CPF válido.");
  }
  return cpf;
}

function normalizeAdultBirthDate(value, now) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw registrationError("invalid_birth_date", "Informe uma data de nascimento válida.");
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw registrationError("invalid_birth_date", "Informe uma data de nascimento válida.");
  }
  const reference = new Date(now);
  if (Number.isNaN(reference.getTime())) throw new TypeError("A data de referência é inválida.");
  let age = reference.getUTCFullYear() - year;
  if (reference.getUTCMonth() + 1 < month || (reference.getUTCMonth() + 1 === month && reference.getUTCDate() < day)) age -= 1;
  if (date > reference || age < 18) throw registrationError("responsible_must_be_adult", "O responsável precisa ter 18 anos ou mais.");
  return text;
}

function normalizeAddress(value, evidence) {
  assertExactFields(value, ADDRESS_FIELDS, "invalid_address");
  const noComplement = value.noComplement === true;
  const complement = String(value.complement ?? "").trim().replace(/\s+/g, " ");
  if ((noComplement && complement) || (!noComplement && !complement) || complement.length > 150) {
    throw registrationError("invalid_address_complement", "Informe o complemento ou marque que o endereço não possui complemento.");
  }
  const address = Object.freeze({
    id: normalizedText(value.id, { min: 1, max: 100, code: "invalid_address", label: "a identificação do endereço" }),
    version: Number(value.version),
    postalCode: normalizeBrazilianPostalCode(value.postalCode),
    street: normalizedText(value.street, { min: 3, max: 200, code: "invalid_address", label: "o logradouro" }),
    number: normalizedText(value.number, { min: 1, max: 30, code: "invalid_address", label: "o número" }),
    complement: noComplement ? null : complement,
    noComplement,
    district: normalizedText(value.district, { min: 2, max: 120, code: "invalid_address", label: "o bairro" }),
    city: normalizedText(value.city, { min: 2, max: 120, code: "invalid_address", label: "a cidade" }),
    state: String(value.state ?? "").trim().toUpperCase(),
  });
  if (!Number.isSafeInteger(address.version) || address.version < 1 || !/^[A-Z]{2}$/.test(address.state)) {
    throw registrationError("invalid_address", "Informe um endereço válido.");
  }
  const verification = requireVerifiedPostalCode(address, evidence);
  return Object.freeze({ ...address, verificationFingerprint: verification.verificationFingerprint, verificationProvider: verification.provider });
}

function normalizeTruthDeclaration(value) {
  assertExactFields(value, new Set(["confirmed", "version"]), "truth_declaration_required");
  if (value.confirmed !== true || value.version !== RESPONSIBLE_TRUTH_DECLARATION_VERSION) {
    throw registrationError("truth_declaration_required", "Confirme a veracidade dos dados usando a versão atual.");
  }
  return Object.freeze({ confirmed: true, version: RESPONSIBLE_TRUTH_DECLARATION_VERSION });
}

function normalizeTerms(value, expectedTerms) {
  assertExactFields(value, new Set(["accepted", "version", "contentHash"]), "terms_acceptance_required");
  const expected = expectedTerms && typeof expectedTerms === "object" ? expectedTerms : {};
  const version = String(expected.version ?? "").trim();
  const contentHash = String(expected.contentHash ?? "").trim().toLowerCase();
  if (expected.status !== "active" || !version || !/^[a-f0-9]{64}$/.test(contentHash)) {
    throw Object.assign(new Error("Não há Termos de Uso ativos disponíveis para aceite."), { code: "active_terms_unavailable", status: 503 });
  }
  if (value.accepted !== true || value.version !== version || String(value.contentHash ?? "").toLowerCase() !== contentHash) {
    throw registrationError("terms_acceptance_required", "Aceite a versão atual dos Termos de Uso.");
  }
  return Object.freeze({ accepted: true, version, contentHash });
}

export function validateResponsibleRegistration(input, { expectedTerms, now = new Date() } = {}) {
  assertExactFields(input, ALLOWED_FIELDS, "invalid_responsible_registration");
  const fullName = normalizedText(input.fullName, { min: 3, max: 160, code: "invalid_full_name", label: "o nome completo" });
  if (fullName.split(" ").length < 2) throw registrationError("invalid_full_name", "Informe o nome completo.");
  return Object.freeze({
    fullName,
    cpf: normalizeCpf(input.cpf),
    birthDate: normalizeAdultBirthDate(input.birthDate, now),
    address: normalizeAddress(input.address, input.postalCodeEvidence),
    truthDeclaration: normalizeTruthDeclaration(input.truthDeclaration),
    terms: normalizeTerms(input.terms, expectedTerms),
  });
}
