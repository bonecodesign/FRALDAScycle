import assert from "node:assert/strict";
import test from "node:test";
import { RESPONSIBLE_TRUTH_DECLARATION_VERSION, normalizeCpf, validateResponsibleRegistration } from "../packages/contracts/responsible-registration.js";

const hash = "a".repeat(64);
const expectedTerms = { status: "active", version: "terms-2026-10", contentHash: hash };

function validInput() {
  return {
    fullName: "Maria da Silva",
    cpf: "529.982.247-25",
    birthDate: "2008-10-25",
    address: { id: "signup-main", version: 1, postalCode: "30110-028", street: "Avenida Afonso Pena", number: "1000", complement: "Apto 10", noComplement: false, district: "Centro", city: "Belo Horizonte", state: "mg" },
    postalCodeEvidence: { postalCode: "30110028", addressVersion: 1, provider: "viacep", placeId: "30110-028", partialMatch: false, exactMatch: true, city: "Belo Horizonte", state: "MG" },
    truthDeclaration: { confirmed: true, version: RESPONSIBLE_TRUTH_DECLARATION_VERSION },
    terms: { accepted: true, version: expectedTerms.version, contentHash: hash },
  };
}

test("normaliza e valida o cadastro completo do responsável", () => {
  const result = validateResponsibleRegistration(validInput(), { expectedTerms, now: new Date("2026-10-25T12:00:00Z") });
  assert.equal(result.fullName, "Maria da Silva");
  assert.equal(result.cpf, "52998224725");
  assert.equal(result.birthDate, "2008-10-25");
  assert.equal(result.address.postalCode, "30110028");
  assert.equal(result.address.state, "MG");
  assert.match(result.address.verificationFingerprint, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(result.terms.version, expectedTerms.version);
});

test("valida matematicamente o CPF", () => {
  assert.equal(normalizeCpf("529.982.247-25"), "52998224725");
  for (const cpf of ["52998224724", "11111111111", "123"])
    assert.throws(() => normalizeCpf(cpf), error => error.code === "invalid_cpf");
});

test("aplica o limite de 18 anos na data exata", () => {
  const input = validInput();
  input.birthDate = "2008-10-26";
  assert.throws(() => validateResponsibleRegistration(input, { expectedTerms, now: new Date("2026-10-25T12:00:00Z") }), error => error.code === "responsible_must_be_adult");
  input.birthDate = "2008-02-30";
  assert.throws(() => validateResponsibleRegistration(input, { expectedTerms, now: new Date("2026-10-25T12:00:00Z") }), error => error.code === "invalid_birth_date");
});

test("exige endereço completo, complemento explícito e CEP verificado", () => {
  const missingComplement = validInput();
  missingComplement.address.complement = "";
  assert.throws(() => validateResponsibleRegistration(missingComplement, { expectedTerms }), error => error.code === "invalid_address_complement");

  const noComplement = validInput();
  noComplement.address.complement = "";
  noComplement.address.noComplement = true;
  assert.equal(validateResponsibleRegistration(noComplement, { expectedTerms }).address.complement, null);

  const staleEvidence = validInput();
  staleEvidence.postalCodeEvidence.addressVersion = 2;
  assert.throws(() => validateResponsibleRegistration(staleEvidence, { expectedTerms }), error => error.code === "address_version_mismatch");
});

test("aceita somente declaração e Termos ativos nas versões confiadas pelo servidor", () => {
  const wrongDeclaration = validInput();
  wrongDeclaration.truthDeclaration.version = "old";
  assert.throws(() => validateResponsibleRegistration(wrongDeclaration, { expectedTerms }), error => error.code === "truth_declaration_required");

  const wrongTerms = validInput();
  wrongTerms.terms.version = "old";
  assert.throws(() => validateResponsibleRegistration(wrongTerms, { expectedTerms }), error => error.code === "terms_acceptance_required");
  assert.throws(() => validateResponsibleRegistration(validInput(), { expectedTerms: { ...expectedTerms, status: "draft" } }), error => error.code === "active_terms_unavailable" && error.status === 503);
});

test("recusa campos extras, inclusive documento e prova de vida no cadastro normal", () => {
  const input = validInput();
  input.document = "base64";
  assert.throws(() => validateResponsibleRegistration(input, { expectedTerms }), error => error.code === "invalid_responsible_registration");
});
