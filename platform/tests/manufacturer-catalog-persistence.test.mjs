import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createManufacturerCatalogService } from "../apps/api/manufacturer-catalog-service.js";
import { createManufacturerCatalogRepository } from "../database/manufacturer-catalog-repository.js";
import { MANUFACTURER_CATALOG_COLUMNS } from "../packages/contracts/manufacturer-catalog-import.js";

const batchId = "10000000-0000-4000-8000-000000000064";

test("migration enforces two independent reviewers and one active batch per manufacturer", async () => {
  const sql = await readFile(new URL("../database/migrations/064_manufacturer_catalog_imports.sql", import.meta.url), "utf8");
  assert.match(sql, /second_reviewer_id <> first_reviewer_id/);
  assert.match(sql, /second_reviewer_id <> imported_by/);
  assert.match(sql, /WHERE status = 'active'/);
  assert.match(sql, /min_age_months IS NOT NULL OR min_weight_kg IS NOT NULL/);
});

test("only administrators with catalog scope may import a validated batch", async () => {
  let received;
  const service = createManufacturerCatalogService({ async importBatch(input) { received = input; return { id: batchId }; } });
  const csv = `${MANUFACTURER_CATALOG_COLUMNS.join(",")}\nSKU-1,infant,Marca,Linha,M,6,18,,\n`;
  const input = { csv, manufacturer: "Marca", sourceUrl: "https://marca.example/tabela.pdf",
    documentSha256: "a".repeat(64), effectiveDate: "2026-10-24" };
  await assert.rejects(service.importBatch({ id: "moderator", role: "moderator" }, input), error => error.code === "forbidden");
  assert.equal((await service.importBatch({ id: "admin", role: "admin" }, input)).id, batchId);
  assert.equal(received.actorId, "admin");
  assert.equal(received.catalog.entries.length, 1);
});

test("second approval supersedes the old batch and activates the new one atomically", async () => {
  const statements = [];
  const client = { async query(sql, values) {
    statements.push({ sql, values });
    if (/SELECT \* FROM manufacturer_catalog_batches/.test(sql)) return { rows: [{ id: batchId,
      manufacturer: "Marca", imported_by: "importer", first_reviewer_id: "reviewer-1",
      status: "pending_second_review", version: 2 }] };
    if (/SET status='active'/.test(sql)) return { rows: [{ id: batchId, status: "active", version: 3 }] };
    return { rows: [] };
  } };
  let transactions = 0;
  const repository = createManufacturerCatalogRepository({ async transaction(operation) { transactions++; return operation(client); } });
  const result = await repository.reviewBatch({ actorId: "reviewer-2", batchId, expectedVersion: 2,
    decision: "approve", reason: "Fonte oficial e conteúdo conferidos." });
  assert.equal(result.status, "active");
  assert.equal(transactions, 1);
  assert.ok(statements.find(({ sql }) => /SET status='superseded'/.test(sql)));
  assert.ok(statements.find(({ sql, values }) => /INSERT INTO audit_events/.test(sql)
    && values[1] === "manufacturer_catalog.approved"));
});

test("import, entries and audit share one transaction", async () => {
  const statements = [];
  const client = { async query(sql, values) {
    statements.push({ sql, values });
    if (/INSERT INTO manufacturer_catalog_batches/.test(sql)) return { rows: [{ id: batchId, status: "pending_first_review", version: 1 }] };
    return { rows: [] };
  } };
  const repository = createManufacturerCatalogRepository({ async transaction(operation) { return operation(client); } });
  await repository.importBatch({ actorId: "admin", catalog: { manufacturer: "Marca",
    sourceUrl: "https://marca.example/tabela.pdf", documentSha256: "b".repeat(64), effectiveDate: "2026-10-24",
    entries: [{ productKey: "SKU-1", category: "infant", brand: "Marca", model: "Linha", size: "M",
      minAgeMonths: 6, maxAgeMonths: 18, minWeightKg: null, maxWeightKg: null }] } });
  assert.equal(statements.length, 3);
  assert.match(statements[1].sql, /jsonb_to_recordset/);
  assert.match(statements[2].sql, /manufacturer_catalog\.imported/);
});
