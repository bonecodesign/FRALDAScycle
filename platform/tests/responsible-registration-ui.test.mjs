import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildResponsibleRegistrationPayload,buildSafeRegistrationDraft } from "../apps/app/responsible-registration.js";

const html = await readFile(new URL("../apps/app/register.html", import.meta.url), "utf8");
const field = (value = "", checked = false) => ({ value, checked });
const fields = () => ({
  fullName: field("Maria da Silva"), cpf: field("529.982.247-25"), birthDate: field("1990-05-12"),
  displayName: field("Maria"), contact: field("maria@example.com"), pilotInvitationToken: field(""),
  password: field("uma frase senha segura"), passwordConfirmation: field("uma frase senha segura"),
  postalCode: field("30110-028"), street: field("Avenida Afonso Pena"), number: field("1000"),
  complement: field("Apto 10"), noComplement: field("", false), district: field("Centro"),
  city: field("Belo Horizonte"), state: field("MG"), truthConfirmed: field("", true), termsAccepted: field("", true),
  familyBirthDate:field('2026-04-25'),familyEmoji:field('🍼'),familyConsent:field('',true),
});
const configuration = { truthDeclarationVersion: "FC-RESPONSIBLE-1", terms: { version: "terms-1", contentHash: "a".repeat(64) } };

test("cadastro completo possui duas etapas e todos os campos aprovados", () => {
  assert.match(html, /id="responsible-register-form" hidden/);
  assert.equal((html.match(/data-registration-step/g) ?? []).length, 3);
  for (const name of ["fullName","cpf","birthDate","displayName","contact","postalCode","street","number","complement","noComplement","district","city","state","truthConfirmed","termsAccepted","familyBirthDate","familyEmoji","familyConsent"])
    assert.match(html, new RegExp(`name="${name}"`));
});

test('payload inclui primeiro perfil somente quando exigido pelo servidor',()=>{
  const result=buildResponsibleRegistrationPayload(fields(),{...configuration,familyProfileRequired:true});
  assert.deepEqual(result.responsible.familyProfile,{birthDate:'2026-04-25',emoji:'🍼',consentConfirmed:true,consentVersion:'FC-CHILD-PROFILE-1',personalizationEnabled:true});
  assert.equal(buildResponsibleRegistrationPayload(fields(),configuration).responsible.familyProfile,undefined);
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

test("rascunho de 24 horas nunca inclui CPF, nascimento, senha ou convite",()=>{
  const input=fields(),draft=buildSafeRegistrationDraft(input,2),serialized=JSON.stringify(draft);
  assert.equal(draft.step,2);assert.equal(draft.address.postalCode,'30110-028');
  for(const secret of [input.cpf.value,input.birthDate.value,input.password.value])assert.doesNotMatch(serialized,new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const field of ['cpf','birthDate','password','passwordConfirmation','pilotInvitationToken'])assert.equal(Object.hasOwn(draft,field),false);
});
