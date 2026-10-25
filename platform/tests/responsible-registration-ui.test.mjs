import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildResponsibleRegistrationPayload } from "../apps/app/responsible-registration.js";

const html = await readFile(new URL("../apps/app/register.html", import.meta.url), "utf8");
const field = (value = "", checked = false) => ({ value, checked });
const fields = () => ({
  fullName: field("Maria da Silva"), cpf: field("529.982.247-25"), birthDate: field("1990-05-12"),
  displayName: field("Maria"), contact: field("maria@example.com"), pilotInvitationToken: field(""),
  password: field("uma frase senha segura"), passwordConfirmation: field("uma frase senha segura"),
  postalCode: field("30110-028"), street: field("Avenida Afonso Pena"), number: field("1000"),
  complement: field("Apto 10"), noComplement: field("", false), district: field("Centro"),
  city: field("Belo Horizonte"), state: field("MG"), truthConfirmed: field("", true), termsAccepted: field("", true),
});
const configuration = { truthDeclarationVersion: "FC-RESPONSIBLE-1", terms: { version: "terms-1", contentHash: "a".repeat(64) } };

test("cadastro completo possui duas etapas e todos os campos aprovados", () => {
  assert.match(html, /id="responsible-register-form" hidden/);
  assert.equal((html.match(/data-registration-step/g) ?? []).length, 2);
  for (const name of ["fullName","cpf","birthDate","displayName","contact","postalCode","street","number","complement","noComplement","district","city","state","truthConfirmed","termsAccepted"])
    assert.match(html, new RegExp(`name="${name}"`));
});

test("payload usa versões fornecidas pelo servidor e não inclui evidência de CEP do navegador", () => {
  const result = buildResponsibleRegistrationPayload(fields(), configuration);
  assert.equal(result.email, "maria@example.com");
  assert.equal(result.responsible.truthDeclaration.version, "FC-RESPONSIBLE-1");
  assert.equal(result.responsible.terms.contentHash, "a".repeat(64));
  assert.equal(result.responsible.postalCodeEvidence, undefined);
});

test("payload exige senhas iguais, aceites e decisão explícita sobre complemento", () => {
  const mismatch = fields(); mismatch.passwordConfirmation.value = "outra frase senha segura";
  assert.throws(() => buildResponsibleRegistrationPayload(mismatch, configuration), /senhas/);
  const noTerms = fields(); noTerms.termsAccepted.checked = false;
  assert.throws(() => buildResponsibleRegistrationPayload(noTerms, configuration), /aceite/);
  const missingComplement = fields(); missingComplement.complement.value = "";
  assert.throws(() => buildResponsibleRegistrationPayload(missingComplement, configuration), /complemento/);
});
