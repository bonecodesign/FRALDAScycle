import assert from "node:assert/strict";
import test from "node:test";
import { MANUFACTURER_CATALOG_COLUMNS, parseManufacturerCatalogCsv, reviewManufacturerCatalog } from "../packages/contracts/manufacturer-catalog-import.js";

const metadata = { manufacturer: "Fabricante Oficial", sourceUrl: "https://fabricante.example/tabela.pdf",
  documentSha256: "a".repeat(64), effectiveDate: "2026-10-24" };
const header = MANUFACTURER_CATALOG_COLUMNS.join(",");

test("imports strict official rows with age, weight or both without child data", () => {
  const result = parseManufacturerCatalogCsv(`${header}\nSKU-1,infant,Marca,Linha M,M,6,18,6.0,10.0\nSKU-2,swim,Marca,Piscina G,G,,,9,14\n`, metadata);
  assert.equal(result.status, "pending_first_review");
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[1].minAgeMonths, null);
  assert.deepEqual(Object.keys(result.entries[0]), ["productKey", "category", "brand", "model", "size",
    "minAgeMonths", "maxAgeMonths", "minWeightKg", "maxWeightKg"]);
});

test("supports quoted commas and rejects unexpected columns, duplicate products and invalid ranges", () => {
  const quoted = parseManufacturerCatalogCsv(`${header}\nSKU-1,infant,Marca,"Linha, Premium",M,6,18,,\n`, metadata);
  assert.equal(quoted.entries[0].model, "Linha, Premium");
  for (const csv of [
    `extra,${header}\nx,SKU-1,infant,Marca,Linha,M,6,18,,\n`,
    `${header}\nSKU-1,infant,Marca,Linha,M,6,18,,\nSKU-1,infant,Marca,Linha,M,6,18,,\n`,
    `${header}\nSKU-1,infant,Marca,Linha,M,18,6,,\n`,
    `${header}\nSKU-1,infant,Marca,Linha,M,,,,\n`,
  ]) assert.throws(() => parseManufacturerCatalogCsv(csv, metadata));
});

test("requires an attributable HTTPS source and immutable document hash", () => {
  for (const patch of [
    { sourceUrl: "http://fabricante.example/tabela" },
    { sourceUrl: "https://user:secret@fabricante.example/tabela" },
    { documentSha256: "short" },
    { effectiveDate: "24/10/2026" },
  ]) assert.throws(() => parseManufacturerCatalogCsv(`${header}\nSKU-1,infant,Marca,Linha,M,6,18,,\n`, { ...metadata, ...patch }),
  error => error.code === "invalid_catalog_source");
});

test("classifies public web sources as auxiliary evidence, never as authority",()=>{
  const parsed=parseManufacturerCatalogCsv('product_key,category,brand,model,size,min_age_months,max_age_months,min_weight_kg,max_weight_kg\nref-1,infant,Marca,Modelo,P,0,12,,',{
    manufacturer:'Referência pública',sourceKind:'public_web_reference',sourceUrl:'https://shop.example/product/ref-1',documentSha256:'a'.repeat(64),effectiveDate:'2026-10-30',
  });
  assert.equal(parsed.sourceKind,'public_web_reference');
});

test("two independent reviewers are mandatory and importer cannot approve", () => {
  const imported = { ...parseManufacturerCatalogCsv(`${header}\nSKU-1,infant,Marca,Linha,M,6,18,,\n`, metadata), importedBy: "importer" };
  assert.throws(() => reviewManufacturerCatalog(imported, { reviewerId: "importer", decision: "approve" }));
  const first = reviewManufacturerCatalog(imported, { reviewerId: "reviewer-1", decision: "approve" });
  assert.equal(first.status, "pending_second_review");
  assert.throws(() => reviewManufacturerCatalog(first, { reviewerId: "reviewer-1", decision: "approve" }));
  const approved = reviewManufacturerCatalog(first, { reviewerId: "reviewer-2", decision: "approve" });
  assert.equal(approved.status, "approved");
  assert.equal(approved.secondReviewerId, "reviewer-2");
});

test("either reviewer may reject without activating the batch", () => {
  const imported = { ...parseManufacturerCatalogCsv(`${header}\nSKU-1,infant,Marca,Linha,M,6,18,,\n`, metadata), importedBy: "importer" };
  assert.equal(reviewManufacturerCatalog(imported, { reviewerId: "reviewer-1", decision: "reject" }).status, "rejected");
});
