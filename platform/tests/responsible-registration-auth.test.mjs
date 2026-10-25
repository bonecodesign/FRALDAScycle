import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createAuthService } from "../apps/api/auth-service.js";
import { loadConfig } from "../apps/api/config.js";
import { RESPONSIBLE_TRUTH_DECLARATION_VERSION } from "../packages/contracts/responsible-registration.js";

const secret = "responsible-cpf-hmac-test-secret-0001";
const contentHash = "c".repeat(64);
const terms = { status: "active", version: "terms-2026-10", contentHash, documents: [{ name: "terms.md", content: "approved" }] };

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
  const service = createAuthService(repository, { responsibleRegistration: { enabled: true, cpfHmacSecret: secret, terms } });
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
    responsibleRegistration: { enabled: true, cpfHmacSecret: secret, terms: { ...terms, status: "draft" } },
  });
  await assert.rejects(service.register(payload()), error => error.code === "active_terms_unavailable" && error.status === 503);
  assert.equal(writes, 0);
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

test("colisão da impressão do CPF retorna conflito específico sem revelar o CPF", async () => {
  const repository = { async createUserWithVerification() {
    throw Object.assign(new Error("unique"), { code: "23505", constraint: "users_cpf_fingerprint_unique" });
  } };
  const service = createAuthService(repository, { responsibleRegistration: { enabled: true, cpfHmacSecret: secret, terms } });
  await assert.rejects(service.register(payload()), error =>
    error.code === "cpf_already_registered" && error.status === 409 && !error.message.includes("529"));
});
