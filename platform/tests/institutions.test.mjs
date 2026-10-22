import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createInstitutionService, InstitutionError } from "../apps/api/institution-service.js";
import { createInstitutionRepository } from "../database/institution-repository.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const INSTITUTION_ID = "22222222-2222-4222-8222-222222222222";
const validApplication = {
  legalName: "Instituto Cuidado Circular",
  publicName: "Cuidado Circular",
  taxId: "12.345.678/0001-90",
  representativeName: "Ana Responsável",
  representativeEmail: "ana@instituto.org.br",
  city: "Belo Horizonte",
  state: "mg",
  addressLine: "Rua Circular, 100",
  postalCode: "30110-000",
  openPackagesAccepted: true,
  documentKeys: ["institutions/application/documento_01"],
};

function repository(status = "pending") {
  const calls = [];
  return {
    calls,
    async listActive(input) { calls.push(["listActive", input]); return []; },
    async listAdmin(input) { calls.push(["listAdmin", input]); return []; },
    async detailAdmin(id) { return id === INSTITUTION_ID ? { id, status, document_keys: validApplication.documentKeys } : null; },
    async createApplication(input) { calls.push(["create", input]); return { id: INSTITUTION_ID, status: "pending", ...input }; },
    async changeStatus(input) { calls.push(["status", input]); return { id: input.institutionId, status: input.status }; },
  };
}

test("institution application normalizes identity, address and document metadata", async () => {
  const store = repository();
  const service = createInstitutionService(store);
  const institution = await service.submit(USER_ID, validApplication);
  assert.equal(institution.taxId, "12345678000190");
  assert.equal(institution.state, "MG");
  assert.equal(institution.postalCode, "30110000");
  assert.equal(institution.status, "pending");
});

test("institution application requires documents and a valid CNPJ shape", async () => {
  const service = createInstitutionService(repository());
  await assert.rejects(
    service.submit(USER_ID, { ...validApplication, taxId: "123", documentKeys: [] }),
    (error) => error instanceof InstitutionError && error.code === "invalid_tax_id",
  );
  await assert.rejects(
    service.submit(USER_ID, { ...validApplication, documentKeys: [] }),
    (error) => error instanceof InstitutionError && error.code === "institution_documents_required",
  );
});

test("institution review enforces the explicit status transition graph", async () => {
  const service = createInstitutionService(repository("pending"));
  const changed = await service.changeStatus(USER_ID, INSTITUTION_ID, {
    status: "under_review", reason: "Documentos recebidos para conferência.",
  });
  assert.equal(changed.status, "under_review");
  await assert.rejects(
    service.changeStatus(USER_ID, INSTITUTION_ID, {
      status: "active", reason: "Tentativa de ativação sem análise prévia.",
    }),
    (error) => error.code === "invalid_status_transition" && error.status === 409,
  );
});

test("individual activation requires three explicit checks and records their attestation", async () => {
  const store = repository("under_review");
  const service = createInstitutionService(store);
  const input = { status: "active", reason: "Documentos e capacidade conferidos individualmente." };
  await assert.rejects(service.changeStatus(USER_ID, INSTITUTION_ID, input),
    error => error.code === "institution_verification_required");
  await assert.rejects(service.changeStatus(USER_ID, INSTITUTION_ID, {
    ...input, verification: { documentsChecked: true, representativeChecked: true, capacityChecked: false },
  }), error => error.code === "institution_verification_required");
  assert.equal(store.calls.length, 0);
  await service.changeStatus(USER_ID, INSTITUTION_ID, {
    ...input, verification: { documentsChecked: true, representativeChecked: true, capacityChecked: true },
  });
  assert.deepEqual(store.calls[0][1].verification, {
    documentsChecked: true, representativeChecked: true, capacityChecked: true,
  });
});

test("institution approval audit persists the individual verification attestation", async () => {
  const statements = [];
  const client = { async query(sql, values) {
    statements.push({ sql, values });
    if (sql.includes("SELECT id, status FROM institutions")) return { rows: [{ id: INSTITUTION_ID, status: "under_review" }] };
    if (sql.includes("UPDATE institutions SET")) return { rows: [{ id: INSTITUTION_ID, status: "active" }] };
    return { rows: [] };
  } };
  const store = createInstitutionRepository({ async transaction(work) { return work(client); } });
  const verification = { documentsChecked: true, representativeChecked: true, capacityChecked: true };
  await store.changeStatus({ actorUserId: USER_ID, institutionId: INSTITUTION_ID,
    status: "active", reason: "Conferência individual concluída.", expectedStatus: "under_review", verification });
  const audit = statements.find(item => item.sql.includes("institution.status.changed"));
  assert.equal(audit.values[0], USER_ID);
  assert.deepEqual(JSON.parse(audit.values[2]).verification, verification);
});

test("institution migration binds donations to a verified destination record", async () => {
  const sql = await readFile(new URL("../database/migrations/018_institutions_and_chat_access.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE institutions/);
  assert.match(sql, /institution_status/);
  assert.match(sql, /ALTER TABLE listings ADD COLUMN institution_id/);
  assert.match(sql, /kind = 'donation' AND institution_id IS NOT NULL/);
  assert.match(sql, /open_packages_accepted/);
});
