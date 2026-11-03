import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createAuthService } from "../apps/api/auth-service.js";
import { loadConfig } from "../apps/api/config.js";
import { RESPONSIBLE_TRUTH_DECLARATION_VERSION } from "../packages/contracts/responsible-registration.js";

const secret = "responsible-cpf-hmac-test-secret-0001";
const contentHash = "c".repeat(64);
const terms = { status: "active", version: "terms-2026-10", contentHash, documents: [{ name: "terms.md", content: "approved" }] };
const postalCodeService = { async lookup() { return { evidence: payload().responsible.postalCodeEvidence }; } };
const responsibleOptions = { enabled: true, cpfHmacSecret: secret, terms, postalCodeService };

function payload() {
  return {
    email: "maria@example.com", password: "uma frase senha segura", displayName: "Maria",
    responsible: {
      fullName: "Maria da Silva", cpf: "529.982.247-25", birthDate: "1990-05-12",
      address: { id: "signup-main", version: 1, postalCode: "30110-028", street: "Avenida Afonso Pena", number: "1000", complement: "Apto 10", noComplement: false, district: "Centro", city: "Belo Horizonte", state: "MG" },
      postalCodeEvidence: { postalCode: "30110028", addressVersion: 1, provider: "viacep", placeId: "30110-028", partialMatch: false, exactMatch: true, city: "Belo Horizonte", state: "MG" },
      truthDeclaration: { confirmed: true, version: RESPONSIBLE_TRUTH_DECLARATION_VERSION },
      terms: { accepted: true, version: terms.version, contentHash },
    },
  };
}

test("cadastro ativo envia somente HMAC do CPF e evidências confiadas ao repositório", async () => {
  let saved;
  const repository = { async createUserWithVerification(input) {
    saved = input;
    return { id: "user-1", email: input.email, phone: null, display_name: input.displayName,
      role: "customer", email_verified_at: null, adult_declared_at: new Date(), adult_declaration_version: input.adultDeclarationVersion };
  } };
  const service = createAuthService(repository, { responsibleRegistration: responsibleOptions });
  const result = await service.register(payload());
  assert.equal(result.verificationRequired, true);
  assert.equal(saved.responsibleRegistration.cpf, undefined);
  assert.deepEqual(saved.responsibleRegistration.cpfFingerprint,
    createHmac("sha256", secret).update("52998224725").digest());
  assert.deepEqual(saved.responsibleRegistration.terms.documents, terms.documents);
  assert.equal(saved.responsibleRegistration.address.verificationProvider, "viacep");
});

test("Termos em rascunho bloqueiam cadastro antes de qualquer escrita", async () => {
  let writes = 0;
  const repository = { async createUserWithVerification() { writes += 1; } };
  const service = createAuthService(repository, {
    responsibleRegistration: { ...responsibleOptions, terms: { ...terms, status: "draft" } },
  });
  await assert.rejects(service.register(payload()), error => error.code === "active_terms_unavailable" && error.status === 503);
  assert.equal(writes, 0);
});

test('cadastro familiar obrigatório chega normalizado para persistência atômica',async()=>{
  let saved;const repository={async createUserWithVerification(input){saved=input;return{id:'user-1',email:input.email,display_name:input.displayName,role:'customer',adult_declared_at:new Date(),adult_declaration_version:input.adultDeclarationVersion};}};
  const service=createAuthService(repository,{responsibleRegistration:{...responsibleOptions,familyProfileRequired:true}}),input=payload();
  input.responsible.familyProfile={birthDate:'2026-04-25',emoji:'🍼',consentConfirmed:true,consentVersion:'FC-CHILD-PROFILE-1',personalizationEnabled:true};
  await service.register(input);assert.deepEqual(saved.responsibleRegistration.familyProfile,{birthDate:'2026-04-25',emoji:'🍼',consentVersion:'FC-CHILD-PROFILE-1'});
});

test("feature fica desligada por padrão e exige segredo exclusivo ao ativar", () => {
  assert.equal(loadConfig({ NODE_ENV: "test" }).responsibleRegistrationEnabled, false);
  assert.throws(() => loadConfig({ NODE_ENV: "test", RESPONSIBLE_REGISTRATION_ENABLED: "true" }),
    /RESPONSIBLE_CPF_HMAC_SECRET/);
  const config = loadConfig({ NODE_ENV: "test", RESPONSIBLE_REGISTRATION_ENABLED: "true", RESPONSIBLE_CPF_HMAC_SECRET: secret });
  assert.equal(config.responsibleRegistrationEnabled, true);
  assert.equal(config.responsibleCpfHmacSecret, secret);
  assert.throws(() => loadConfig({ NODE_ENV: "test", RESPONSIBLE_REGISTRATION_ENABLED: "true",
    RESPONSIBLE_CPF_HMAC_SECRET: secret, SESSION_SECRET: secret }), /must not reuse SESSION_SECRET/);
});

test('rascunho de cadastro exige chave dedicada e reconhecimento em produção',()=>{
  const draftKey=Buffer.alloc(32,9).toString('base64url');
  assert.throws(()=>loadConfig({NODE_ENV:'test',REGISTRATION_DRAFTS_ENABLED:'true'}),/RESPONSIBLE_REGISTRATION_ENABLED/);
  assert.throws(()=>loadConfig({NODE_ENV:'test',RESPONSIBLE_REGISTRATION_ENABLED:'true',RESPONSIBLE_CPF_HMAC_SECRET:secret,REGISTRATION_DRAFTS_ENABLED:'true'}),/REGISTRATION_DRAFT_ENCRYPTION_KEY/);
  const config=loadConfig({NODE_ENV:'test',RESPONSIBLE_REGISTRATION_ENABLED:'true',RESPONSIBLE_CPF_HMAC_SECRET:secret,REGISTRATION_DRAFTS_ENABLED:'true',REGISTRATION_DRAFT_ENCRYPTION_KEY:draftKey});
  assert.equal(config.registrationDraftsEnabled,true);
  assert.throws(()=>loadConfig({NODE_ENV:'production',DATABASE_URL:'postgres://db/test',SESSION_SECRET:'different-session-secret-000000001',NOTIFICATION_WEBHOOK_URL:'https://notify.example.test',NOTIFICATION_WEBHOOK_SECRET:'notification-secret',RESPONSIBLE_REGISTRATION_ENABLED:'true',RESPONSIBLE_CPF_HMAC_SECRET:secret,REGISTRATION_DRAFTS_ENABLED:'true',REGISTRATION_DRAFT_ENCRYPTION_KEY:draftKey}),/REGISTRATION_DRAFTS_ACTIVATION_ACKNOWLEDGED/);
});

test("colisão da impressão do CPF retorna conflito específico sem revelar o CPF", async () => {
  const repository = { async createUserWithVerification() {
    throw Object.assign(new Error("unique"), { code: "23505", constraint: "users_cpf_fingerprint_unique" });
  } };
  const service = createAuthService(repository, { responsibleRegistration: responsibleOptions });
  await assert.rejects(service.register(payload()), error =>
    error.code === "cpf_already_registered" && error.status === 409 && !error.message.includes("529"));
});
