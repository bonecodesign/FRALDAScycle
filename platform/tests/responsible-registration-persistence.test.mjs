import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createResponsibleRegistrationRepository } from "../database/responsible-registration-repository.js";

const migration = await readFile(new URL("../database/migrations/065_responsible_registration.sql", import.meta.url), "utf8");

function input() {
  return {
    fullName: "Maria da Silva",
    cpfFingerprint: Buffer.alloc(32, 7),
    birthDate: "1990-05-12",
    address: { postalCode: "30110028", street: "Avenida Afonso Pena", number: "1000", complement: null, district: "Centro", city: "Belo Horizonte", state: "MG", version: 1, verificationFingerprint: "a".repeat(43), verificationProvider: "viacep" },
    truthDeclaration: { version: "FC-RESPONSIBLE-1" },
    terms: { version: "terms-2026-10", contentHash: "b".repeat(64), documents: [{ kind: "terms", body: "snapshot" }] },
  };
}

test("schema guarda somente impressão do CPF e exige um endereço principal verificado", () => {
  assert.match(migration, /cpf_fingerprint bytea/);
  assert.match(migration, /octet_length\(cpf_fingerprint\) = 32/);
  assert.match(migration, /CREATE UNIQUE INDEX users_cpf_fingerprint_unique/);
  assert.match(migration, /CREATE UNIQUE INDEX addresses_one_primary_per_user/);
  assert.match(migration, /addresses_primary_verification_required/);
  assert.doesNotMatch(migration, /cpf\s+(?:char|text|varchar)/i);
});

test("conclui responsável, endereço e aceite na mesma transação sem auditar dados sensíveis", async () => {
  const queries = [];
  const rows = [
    [{ id: "user-1", responsible_registration_completed_at: null }],
    [{ id: "user-1", legal_name: "Maria da Silva", responsible_truth_version: "FC-RESPONSIBLE-1", responsible_registration_completed_at: new Date() }],
    [{ id: "address-1", label: "Principal", is_primary: true, version: 1, created_at: new Date() }],
    [{ id: "acceptance-1", version: "terms-2026-10", content_hash: "b".repeat(64), accepted_at: new Date() }],
    [],
  ];
  const database = { transaction: callback => callback({ query: async (sql, params) => {
    queries.push({ sql, params });
    return { rows: rows.shift() };
  } }) };
  const result = await createResponsibleRegistrationRepository(database).complete("user-1", input());
  assert.equal(result.address.is_primary, true);
  assert.equal(result.acceptance.version, "terms-2026-10");
  assert.equal(queries.length, 5);
  const audit = queries.at(-1);
  assert.doesNotMatch(audit.sql + JSON.stringify(audit.params), /52998224725|1990-05-12|Avenida Afonso Pena/);
  assert.match(audit.params[1], /termsVersion/);
});

test("recusa CPF bruto, impressão inválida e segunda conclusão", async () => {
  const repository = createResponsibleRegistrationRepository({ transaction: callback => callback({ query: async () => ({ rows: [] }) }) });
  const rawCpf = { ...input(), cpf: "52998224725" };
  await assert.rejects(repository.complete("user-1", rawCpf), error => error.code === "invalid_responsible_persistence");
  const invalid = input();
  invalid.cpfFingerprint = Buffer.alloc(16);
  await assert.rejects(repository.complete("user-1", invalid), error => error.code === "invalid_cpf_fingerprint");

  const completed = createResponsibleRegistrationRepository({ transaction: callback => callback({ query: async () => ({ rows: [{ id: "user-1", responsible_registration_completed_at: new Date() }] }) }) });
  await assert.rejects(completed.complete("user-1", input()), error => error.code === "responsible_registration_already_completed");
});
